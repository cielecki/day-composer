import React, { useState } from 'react';
import { ContentBlock } from '../utils/chat/types';
import { NavigationTarget } from '../obsidian-tools';
import { ThinkingCollapsibleBlock, RedactedThinkingBlock as RedactedThinking, ToolBlock } from './CollapsibleBlock';
import { getObsidianTools } from '../obsidian-tools';
import { useAIAgent } from '../context/AIAgentContext';
import { useTextToSpeech } from '../context/TextToSpeechContext';
import { useSpeechToText } from '../context/SpeechToTextContext';
import { t } from '../i18n';
import { LucideIcon } from './LucideIcon';
import { ToolResultBlock } from '../utils/chat/types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageDisplayProps {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  toolResults?: Map<string, ToolResultBlock>;
  messageIndex?: number;
  isLastMessage?: boolean;
  isGeneratingResponse?: boolean;
  newAbortController?: () => AbortController;
  abort?: () => void;
}

// Helper to ensure content is always ContentBlock[]
const ensureContentBlocksForDisplay = (content: string | ContentBlock[]): ContentBlock[] => {
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
    }
    if (Array.isArray(content)) {
        return content;
    }
    return [];
};

export const MessageDisplay: React.FC<MessageDisplayProps> = ({
  role,
  content,
  toolResults = new Map(),
  messageIndex,
  isLastMessage = false,
  isGeneratingResponse = false,
  newAbortController,
  abort,
}) => {
  const { editUserMessage, startEditingMessage } = useAIAgent();
  const { speakText, isPlayingAudio, isGeneratingSpeech, stopAudio, isPaused, pauseAudio, resumeAudio } = useTextToSpeech();
  const { isRecording } = useSpeechToText();
  const [copyIcon, setCopyIcon] = useState('copy');

  const contentBlocksToRender = ensureContentBlocksForDisplay(content);
  const toolResultsMap = toolResults;

  // Helper to extract plain text from content blocks
  const getPlainTextContent = (blocks: ContentBlock[]): string => {
    return blocks
      .filter(block => block.type === 'text')
      .map(block => (block as any).text || '')
      .join('\n');
  };

  // Handle copy message
  const handleCopyMessage = () => {
    const textToCopy = getPlainTextContent(contentBlocksToRender);
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopyIcon('check');
      setTimeout(() => setCopyIcon('copy'), 2000);
    }
  };

  // Handle edit message button click
  const handleEditClick = () => {
    if (role === 'user' && messageIndex !== undefined) {
      startEditingMessage(messageIndex);
    }
  };

  // Handle speak message with pause/resume functionality
  const handleSpeakMessage = () => {
    if (role === 'assistant') {
      // Don't allow TTS if recording is active
      if (isRecording) {
        console.log("🚫 Cannot start TTS because recording is active");
        return;
      }
      
      if (isPaused) {
        // If audio is paused, resume it
        resumeAudio();
      } else if (isPlayingAudio) {
        // If audio is playing, pause it
        pauseAudio();
      } else if (isGeneratingSpeech) {
        // If speech is generating, stop it
        stopAudio();
      } else {
        // Otherwise start playing the text
        const textToSpeak = getPlainTextContent(contentBlocksToRender);
        if (textToSpeak) {
          // Pass a dummy abort signal since TTS context creates its own controller internally
          const dummyController = new AbortController();
          speakText(textToSpeak, dummyController.signal, true);
        }
      }
    }
  };

  // Handle stop message (separate from pause)
  const handleStopMessage = () => {
    if (role === 'assistant') {
      stopAudio();
    }
  };

  // Helper to render individual content blocks
  const renderContentBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case 'text': {
        return (
          <div key={`block-${index}`} className="markdown-content">
            <MarkdownRenderer
              content={block.text}
            />
          </div>
        );
      }
      case 'image': {
        // Create URL from base64 data
        const imageUrl = `data:${block.source.media_type};base64,${block.source.data}`;
        return (
          <div key={`block-${index}`} className="image-content">
            <img 
              src={imageUrl} 
              alt={t('ui.message.attachedImage')}
              className="attached-image-preview"
              style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'contain' }}
            />
          </div>
        );
      }
      case 'thinking': {
        // Defensive check, although TS expects 'thinking' property
        const thinkingContent = block.thinking || '';
        return (
          <ThinkingCollapsibleBlock
            key={`block-${index}`}
            thinking={thinkingContent}
            reasoningInProgress={block.reasoningInProgress}
            defaultOpen={false}
          />
        );
      }
      case 'redacted_thinking':
        return (
          <RedactedThinking key={`block-${index}`} />
        );
      case 'tool_use': {
        const resultData = toolResultsMap.get(block.id);
        const tool = getObsidianTools(undefined!).getToolByName(block.name);
        
        // Determine if we have any result content and if it's complete
        const hasContent = resultData && resultData.content && resultData.content.length > 0;
        const isComplete = resultData?.is_complete ?? false;
        const resultContent = resultData?.content || '';
        
        const navigationTargets = resultData?.navigationTargets;
        
        // Detect error based on result content starting with ❌
        const isErrorByContent = typeof resultContent === 'string' && resultContent.trim().startsWith('❌');
        
        // Get the tool result block to check for error state
        const toolResultEntry = Array.from(toolResultsMap.entries())
          .find(([id]) => id === block.id);
        const isErrorByFlag = toolResultEntry && 
          typeof toolResultEntry[1] === 'object' && 
          toolResultEntry[1].is_error;
          
        // Use either method to determine if it's an error
        const isError = isErrorByFlag || isErrorByContent;
        
        // Check if the tool has a custom rendering method
        if (tool && tool.renderResult && isComplete) {
          return (
            <div key={`block-${index}`} className={`tool-custom-renderer ${isError ? 'tool-error' : ''}`}>
              <div className="tool-custom-header">
                <span className="tool-custom-title">
                  {tool.getActionText(block.input, true, isComplete, !!isError)}
                </span>
              </div>
              <div className="tool-custom-content">
                {tool.renderResult(resultContent, block.input)}
              </div>
            </div>
          );
        }
        // Fall back to the default rendering
        return (
          <ToolBlock
            key={`block-${index}`}
            toolName={block.name}
            toolInput={block.input}
            isComplete={isComplete}
            result={resultContent}
            isError={!!isError}
            navigationTargets={navigationTargets}
            defaultOpen={false}
          />
        );
      }
      case 'tool_result':
        return null; // Not rendered directly
      default:
        console.warn("Unknown content block type encountered:", (block as any)?.type);
        return null;
    }
  };

  // Determine message classes based on props
  const messageClasses = ['message', role];
  if (contentBlocksToRender.length > 0) {
    messageClasses.push('has-content-blocks');
  }
  if (isLastMessage) {
    messageClasses.push('is-last-message');
  }
  if (isGeneratingResponse) {
    messageClasses.push('is-generating');
  }

  const hasTextContent = contentBlocksToRender.some(block => block.type === 'text');
  const isTextContentLast = contentBlocksToRender.length > 0 && contentBlocksToRender[contentBlocksToRender.length - 1].type === 'text';
  const shouldShowUserActions = role === 'user' && contentBlocksToRender.length > 0;
  const shouldShowAssistantActions = role === 'assistant' && isTextContentLast;
  const shouldShowActions = shouldShowUserActions || shouldShowAssistantActions;

  return (
    <div className={messageClasses.join(' ')}>
      <div className="message-content">
        <div className="content-blocks">
          {contentBlocksToRender.map(renderContentBlock)}
        </div>

        {shouldShowActions && (
          <div className="message-actions">
            {!isGeneratingResponse && <>
              {role === 'user' && (
                <>
                  <button 
                    className="clickable-icon" 
                    onClick={handleEditClick}
                    aria-label={t('ui.message.edit')}
                  >
                    <LucideIcon name="pencil" size={18} />
                  </button>
                  {hasTextContent && (
                    <button 
                      className="clickable-icon" 
                      onClick={handleCopyMessage}
                      aria-label={t('ui.message.copy')}
                    >
                      <LucideIcon name={copyIcon} size={18} />
                    </button>
                  )}
                </>
              )}
              
              {role === 'assistant' && (
                <>
                  {hasTextContent && (
                    <>
                      {/* Play/Pause button */}
                      <button 
                        className={`clickable-icon ${isPaused ? 'paused' : isPlayingAudio ? 'playing' : isGeneratingSpeech ? 'generating' : ''} ${isRecording ? 'disabled' : ''}`}
                        onClick={handleSpeakMessage}
                        disabled={isRecording}
                        aria-label={
                          isRecording
                            ? t('ui.message.recordingInProgress')
                            : isPaused
                              ? t('ui.message.resumeAudio')
                              : isPlayingAudio 
                                ? t('ui.message.pauseAudio') 
                                : isGeneratingSpeech 
                                  ? t('ui.message.generatingSpeech') 
                                  : t('ui.message.speak')
                        }
                      >
                        {isGeneratingSpeech ? (
                          <LucideIcon name="loader" size={18} />
                        ) : isPaused ? (
                          <LucideIcon name="play" size={18} />
                        ) : isPlayingAudio ? (
                          <LucideIcon name="pause" size={18} />
                        ) : (
                          <LucideIcon name="volume-2" size={18} />
                        )}
                      </button>
                      
                      {/* Stop button - only show when audio is playing, paused, or generating */}
                      {(isPlayingAudio || isPaused || isGeneratingSpeech) && (
                        <button 
                          className="clickable-icon stop-button"
                          onClick={handleStopMessage}
                          disabled={isRecording}
                          aria-label={t('ui.message.stopAudio')}
                        >
                          <LucideIcon name="square" size={18} />
                        </button>
                      )}
                    </>
                  )}
                  {hasTextContent && (
                    <button 
                      className="clickable-icon" 
                      onClick={handleCopyMessage}
                      aria-label={t('ui.message.copy')}
                    >
                      <LucideIcon name={copyIcon} size={18} />
                    </button>
                  )}
                </>
              )}
            </>}
          </div>
        )}
      </div>
    </div>
  );
};
