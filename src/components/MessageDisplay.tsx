import React, { useState, useEffect, useCallback } from 'react';
import { ContentBlock } from '../types/message';
import { NavigationTarget } from '../obsidian-tools';
import { ThinkingCollapsibleBlock, RedactedThinkingBlock as RedactedThinking, ToolBlock } from 'src/components/CollapsibleBlock';
import { getObsidianTools } from '../obsidian-tools';
import { usePluginStore } from '../store/plugin-store';
import { t } from 'src/i18n';
import { LucideIcon } from './LucideIcon';
import { ToolResultBlock } from '../types/message';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageDisplayProps {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  toolResults?: Map<string, ToolResultBlock>;
  messageIndex?: number;
  isLastMessage?: boolean;
  isGeneratingResponse?: boolean;
}

/**
 * Component for rendering fix with guide buttons in error messages
 */
const FixWithGuideButton: React.FC<{
  helpPrompt: string;
  buttonText: string;
}> = ({ helpPrompt, buttonText }) => {
  const { setActiveModeWithPersistence, addUserMessage } = usePluginStore();

  const handleButtonClick = async () => {
    // Switch to guide mode
    await setActiveModeWithPersistence(':prebuilt:guide');
    
    // Send the fix prompt
    await addUserMessage(helpPrompt, []);
  };

  return (
    <button
      className="clickable-icon"
      onClick={handleButtonClick}
      aria-label={buttonText}
      title="Switch to Guide mode and get help fixing this issue"
    >
      <LucideIcon name="message-circle-question" size={18} />
    </button>
  );
};

/**
 * Component for rendering retry buttons
 */
const RetryButton: React.FC<{ messageIndex?: number }> = ({ messageIndex }) => {
  const { retryFromMessage } = usePluginStore();

  const handleRetryClick = async () => {
    if (messageIndex !== undefined) {
      // Retry from the specified message index
      await retryFromMessage(messageIndex);
    }
  };

  return (
    <button
      className="clickable-icon"
      onClick={handleRetryClick}
      aria-label={t('errors.retryButton')}
      title="Retry from this message"
    >
      <LucideIcon name="rotate-ccw" size={18} />
    </button>
  );
};

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
}) => {
  // Get specific state slices from Zustand store with granular subscriptions
  const isRecording = usePluginStore(state => state.audio.isRecording);
  const currentModeId = usePluginStore(state => state.modes.activeId);
  const currentMode = usePluginStore(state => state.modes.available[state.modes.activeId]);
  
  // Extract individual values from TTS state - updated property names
  const isSpeaking = usePluginStore(state => state.audio.isSpeaking);
  const isGeneratingSpeech = usePluginStore(state => state.audio.isGeneratingSpeech);
  const isPaused = usePluginStore(state => state.audio.isSpeakingPaused);
  const stopAudio = usePluginStore(state => state.audioStop);
  const pauseAudio = usePluginStore(state => state.speakingPause);
  const resumeAudio = usePluginStore(state => state.speakingResume);

  // Use actual TTS store method
  const speakingStart = usePluginStore(state => state.speakingStart);

  const [copyIcon, setCopyIcon] = useState<'copy' | 'check'>('copy');
  const [toolsCache, setToolsCache] = useState<Map<string, any>>(new Map());

  const contentBlocksToRender = ensureContentBlocksForDisplay(content);
  const toolResultsMap = toolResults;

  // Helper to get plain text content
  const getPlainTextContent = (blocks: ContentBlock[]): string => {
    const textBlocks = blocks.filter(block => block.type === 'text');
    
    const result = textBlocks
      .map(block => {
        const text = (block as any).text;
        return text;
      })
      .join(' ');
    
    return result;
  };

  // Use actual editing method from store
  const startEditingMessage = usePluginStore(state => state.startEditingMessage);

  // Load tools asynchronously when needed
  useEffect(() => {
    const loadToolsForBlocks = async () => {
      const contentBlocks = ensureContentBlocksForDisplay(content);
      const toolBlocks = contentBlocks.filter(block => block.type === 'tool_use');
      const obsidianTools = getObsidianTools();
      
      for (const block of toolBlocks) {
        const toolName = (block as any).name;
        if (toolName && !toolsCache.has(toolName)) {
          try {
            const tool = await obsidianTools.getToolByName(toolName);
            if (tool) {
              setToolsCache(prev => new Map(prev.set(toolName, tool)));
            }
          } catch (error) {
            console.error(`Failed to load tool ${toolName}:`, error);
          }
        }
      }
    };
    
    loadToolsForBlocks();
  }, [content, toolsCache]);

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
        console.debug("🚫 Cannot start TTS because recording is active");
        return;
      }
      
      if (isPaused) {
        // If audio is paused, resume it
        resumeAudio();
      } else if (isSpeaking) {
        // If audio is playing, pause it
        pauseAudio();
      } else if (isGeneratingSpeech) {
        // If speech is generating, stop it
        stopAudio();
      } else {
        // Otherwise start playing the text
        const textToSpeak = getPlainTextContent(contentBlocksToRender);
        if (textToSpeak) {
          speakingStart(textToSpeak);
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
          <MarkdownRenderer
            key={`text-${index}`}
            content={block.text}
          />
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
              className="attached-image-preview ln-image-preview"
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
        const tool = toolsCache.get(block.name);
        
        // Determine if we have any result content and if it's complete
        const hasContent = resultData && resultData.content && resultData.content.length > 0;
        const isComplete = resultData?.is_complete ?? false;
        const resultContent = resultData?.content || '';
        
        const navigationTargets = resultData?.navigation_targets;
        
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
                  {resultData?.current_label || tool?.initialLabel || block.name}
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
            currentLabel={resultData?.current_label}
            defaultOpen={false}
          />
        );
      }
      case 'tool_result':
        return null; // Not rendered directly
      case 'error_message': {
        const errorBlock = block as any;
        const modeName = currentMode?.name || currentModeId || 'unknown mode';
        const helpPrompt = t('errors.helpPrompt', { 
          error: errorBlock.text,
          mode: modeName
        });
        
        return (
          <div key={`block-${index}`} className="error-message-block">
            <div className="error-message-content">
              <MarkdownRenderer content={errorBlock.text} />
              <div className="error-message-actions">
                <RetryButton messageIndex={messageIndex} />
                <FixWithGuideButton 
                  helpPrompt={helpPrompt}
                  buttonText={t('errors.helpButton')}
                />
              </div>
            </div>
          </div>
        );
      }
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
                        className={`clickable-icon ${isPaused ? 'paused' : isSpeaking ? 'playing' : isGeneratingSpeech ? 'generating' : ''} ${isRecording ? 'disabled' : ''}`}
                        onClick={handleSpeakMessage}
                        disabled={isRecording}
                        aria-label={
                          isRecording
                            ? t('ui.message.recordingInProgress')
                            : isPaused
                              ? t('ui.message.resumeAudio')
                              : isSpeaking 
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
                        ) : isSpeaking ? (
                          <LucideIcon name="pause" size={18} />
                        ) : (
                          <LucideIcon name="volume-2" size={18} />
                        )}
                      </button>
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
                  <RetryButton messageIndex={messageIndex} />
                </>
              )}
            </>}
          </div>
        )}
      </div>
    </div>
  );
};
