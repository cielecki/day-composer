import React, { useState, useEffect, useCallback } from 'react';
import { ContentBlock } from '../types/chat-types';
import { NavigationTarget } from '../obsidian-tools';
import { ThinkingCollapsibleBlock, RedactedThinkingBlock as RedactedThinking, ToolBlock } from 'src/components/CollapsibleBlock';
import { getObsidianTools } from '../obsidian-tools';
import { usePluginStore } from '../store/plugin-store';
import { t } from 'src/i18n';
import { LucideIcon } from './LucideIcon';
import { ToolResultBlock } from '../types/chat-types';
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
 * Component for rendering action buttons in error messages
 */
const ErrorMessageButton: React.FC<{
  action: string;
  icon: string;
  label: string;
  description: string;
}> = ({ action, icon, label, description }) => {
  const { setActiveModeWithPersistence, addUserMessage } = usePluginStore();

  const handleButtonClick = async () => {
    if (action === 'fix-mode-format') {
      // Switch to guide mode
      await setActiveModeWithPersistence(':prebuilt:guide');
      
      // Send a message to help fix the mode format
      		const message = "I have a mode file that uses the old ln_ attribute format (like ln_description, ln_icon, etc.) and I need help updating it to the new human-readable format (description, icon, etc.). Can you help me fix this mode file formatting?";
      
      // Send the message
      await addUserMessage(message, []);
    }
  };

  return (
    <button
      className="error-action-button"
      onClick={handleButtonClick}
      title={description}
    >
      <span className="error-button-icon">{icon}</span>
      <span className="error-button-label">{label}</span>
    </button>
  );
};

/**
 * Parses content to extract buttons and regular text
 */
function parseContentWithButtons(content: string): {
  parts: Array<{ type: 'text' | 'button'; content: string; buttonData?: any }>;
} {
  const buttonRegex = /\[BUTTON:([^:]+):([^:]+):([^\]]+)\]/g;
  const parts: Array<{ type: 'text' | 'button'; content: string; buttonData?: any }> = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = buttonRegex.exec(content)) !== null) {
    // Add text before button
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }
    
    // Add button
    const [, action, icon, label] = match;
    parts.push({
      type: 'button',
      content: match[0],
      buttonData: { action, icon, label, description: `${label}` }
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      parts.push({ type: 'text', content: textContent });
    }
  }
  
  // If no buttons found, return the whole content as text
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }
  
  return { parts };
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
}) => {
  // Get specific state slices from Zustand store with granular subscriptions
  const isRecording = usePluginStore(state => state.audio.isRecording);
  
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
        // Check if this text contains buttons (for error messages)
        const { parts } = parseContentWithButtons(block.text);
        
        if (parts.some(part => part.type === 'button')) {
          return (
            <div key={`block-${index}`} className="markdown-content error-message-with-buttons">
              {parts.map((part, partIndex) => {
                if (part.type === 'button' && part.buttonData) {
                  return (
                    <ErrorMessageButton
                      key={`button-${partIndex}`}
                      action={part.buttonData.action}
                      icon={part.buttonData.icon}
                      label={part.buttonData.label}
                      description={part.buttonData.description}
                    />
                  );
                } else {
                  return (
                    <MarkdownRenderer
                      key={`text-${partIndex}`}
                      content={part.content}
                    />
                  );
                }
              })}
            </div>
          );
        }
        
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
                </>
              )}
            </>}
          </div>
        )}
      </div>
    </div>
  );
};
