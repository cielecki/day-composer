import type { ImmerStateCreator } from '../store/plugin-store';
import { Message, ToolResultBlock } from '../types/message';
import { AttachedImage } from 'src/types/attached-image';
import { Chat, CURRENT_SCHEMA_VERSION } from 'src/utils/chat/conversation';
import { generateChatId } from 'src/utils/chat/generate-conversation-id';
import { createUserMessage, extractUserMessageContent } from 'src/utils/chat/message-builder';
import { runConversationTurn } from 'src/utils/chat/conversation-turn';
import { getObsidianTools } from '../obsidian-tools';
import { expandLinks, SystemPromptParts } from 'src/utils/links/expand-links';
import { Notice } from 'obsidian';
import { t } from 'src/i18n';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { ensureContentBlocks, extractTextForTTS } from 'src/utils/chat/content-blocks';
import { getDefaultLNMode } from 'src/utils/modes/ln-mode-defaults';
import { ApiUsageData } from 'src/types/cost-tracking';
import { calculateApiCallCost, calculateChatCostData } from 'src/utils/cost/cost-calculator';

// Extend Message type to include unique ID for React keys
export interface MessageWithId extends Message {
  messageId?: string;
}

// Helper to generate unique message IDs
const generateMessageId = () => {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper to ensure message has ID
const ensureMessageId = (message: Message): MessageWithId => {
  // Create a new object to avoid mutating the original
  const messageWithId: MessageWithId = { ...message };
  if (!messageWithId.messageId) {
    messageWithId.messageId = generateMessageId();
  }
  return messageWithId;
};

// Chat slice interface
export interface ChatSlice {
  // State
  chats: {
    current: Chat;
    isGenerating: boolean;
    editingMessage: { index: number; content: string; images?: AttachedImage[] } | null;
    liveToolResults: Map<string, ToolResultBlock>;
  };
  
  // Basic Actions
  addMessage: (message: Message) => void;
  updateMessage: (index: number, message: Message) => void;
  clearChat: () => void;
  reset: () => void; // Alias for clearChat to match AIAgentContext
  setIsGenerating: (generating: boolean) => void;
  setEditingMessage: (editing: { index: number; content: string; images?: AttachedImage[] } | null) => void;
  updateLiveToolResult: (toolId: string, result: ToolResultBlock) => void;
  clearLiveToolResults: () => void;
  setCurrentChat: (chat: Chat) => void;
  
  // Business Logic Actions
  addUserMessage: (userMessage: string, images?: AttachedImage[]) => Promise<void>;
  editUserMessage: (messageIndex: number, newContent: string, images?: AttachedImage[]) => Promise<void>;
  getCurrentConversationId: () => string | null;
  getSystemPrompt: (modeId: string) => Promise<SystemPromptParts>;
  startEditingMessage: (messageIndex: number) => void;
  cancelEditingMessage: () => void;
  runConversationTurnWithContext: () => Promise<void>;
  retryFromMessage: (messageIndex: number) => Promise<void>;
  chatStop: () => void;
  saveImmediatelyIfNeeded: (force?: boolean) => Promise<void>;
  
  // Cost tracking
  updateCostEntry: (model: string, usage: ApiUsageData, timestamp: number, duration?: number, apiCallId?: string) => void;
}

// Create conversation slice - now get() returns full PluginStore type
export const createChatSlice: ImmerStateCreator<ChatSlice> = (set, get) => {
  let abortController: AbortController | null = null;
  let saveTimeout: NodeJS.Timeout | null = null;
  
  // Debounced save function - cancels previous save and schedules new one
  const debouncedSave = () => {
    // Clear any existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    // Schedule new save after 2 seconds
    saveTimeout = setTimeout(async () => {
      const state = get();
      
      // Only save if there are messages and not currently generating
      if (state.chats.current.storedConversation.messages.length > 0 && 
          !state.chats.isGenerating) {
        try {
          await state.autoSaveConversation();
          console.debug('Auto-saved conversation after 2s debounce');
        } catch (error) {
          console.error('Failed to auto-save conversation:', error);
        }
      }
      
      saveTimeout = null;
    }, 2000);
  };
  
  return {
    chats: {
      current: {
        meta: {
          id: generateChatId(),
          title: '',
          filePath: '',
          updatedAt: 0
        },
        storedConversation: {
          version: CURRENT_SCHEMA_VERSION,
          modeId: '',
          titleGenerated: false,
          messages: [],
          costData: {
            total_cost: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cache_write_tokens: 0,
            total_cache_read_tokens: 0,
            entries: [],
          }
        }
      },
      isGenerating: false,
      editingMessage: null,
      liveToolResults: new Map(),
    },
    
    addMessage: (message) => {
      set((state) => {
        // Ensure message has a unique ID for React reconciliation
        const messageWithId = ensureMessageId(message);
        
        // Create a new messages array to avoid proxy issues
        const newMessages = [...state.chats.current.storedConversation.messages, messageWithId];
        state.chats.current.storedConversation.messages = newMessages;
      });
      
      // Trigger debounced autosave after content change
      get().saveImmediatelyIfNeeded(true);
    },
    
    updateMessage: (index, message) => {
      set((state) => {
        const messages = state.chats.current.storedConversation.messages;
        if (index >= 0 && index < messages.length) {
          // Ensure message has ID (preserve existing ID if available)
          const existingMessage = messages[index] as MessageWithId;
          const messageWithId = ensureMessageId(message);
          if (existingMessage.messageId) {
            messageWithId.messageId = existingMessage.messageId;
          }
          
          // Create new messages array to avoid proxy issues
          const newMessages = [...messages];
          newMessages[index] = messageWithId;
          state.chats.current.storedConversation.messages = newMessages;
        }
      });
      
      // Trigger debounced autosave after content change
      debouncedSave();
    },
    
    clearChat: () => {
      get().chatStop();

      if (get().audio.isSpeaking || get().audio.isGeneratingSpeech) {
        get().audioStop();
      }

      // Cancel any pending autosave
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }

      set((state) => {
        state.chats.current = {
          meta: {
            id: generateChatId(),
            title: '',
            filePath: '',
            updatedAt: 0
          },
          storedConversation: {
            version: CURRENT_SCHEMA_VERSION,
            modeId: '',
            titleGenerated: false,
            messages: [],
            costData: {
              total_cost: 0,
              total_input_tokens: 0,
              total_output_tokens: 0,
              total_cache_write_tokens: 0,
              total_cache_read_tokens: 0,
              entries: [],
            }
          }
        };
        state.chats.liveToolResults.clear();
        state.chats.editingMessage = null;
      })
    },
    
    reset: () => {
      const state = get();
      state.clearChat();
    },
    
    setIsGenerating: (generating) => set((state) => {
      state.chats.isGenerating = generating;
    }),
    
    setEditingMessage: (editing) => set((state) => {
      state.chats.editingMessage = editing;
    }),
    
    updateLiveToolResult: (toolId, result) => set((state) => {
      state.chats.liveToolResults.set(toolId, result);
    }),
    
    clearLiveToolResults: () => set((state) => {
      state.chats.liveToolResults.clear();
    }),
    
    setCurrentChat: (chat) => set((state) => {
      // Ensure all messages have IDs when loading conversation
      const messagesWithIds = chat.storedConversation.messages.map(msg => ensureMessageId(msg));
      const conversationWithIds = {
        ...chat,
        storedConversation: {
          ...chat.storedConversation,
          messages: messagesWithIds
        }
      };
      
      state.chats.current = conversationWithIds;
    }),
    
    // Business Logic Implementation
    getSystemPrompt: async (modeId: string) => {
      const state = get();
      
      const currentActiveMode = state.modes.available[modeId];
      const plugin = LifeNavigatorPlugin.getInstance();
      
      if (!currentActiveMode || !plugin) {
        return {
          staticSection: '',
          semiDynamicSection: '',
          dynamicSection: '',
          fullContent: ''
        };
      }
      
      // Conditionally expand links based on mode setting
      if (currentActiveMode.expand_links) {
        return (await expandLinks(plugin.app, currentActiveMode.system_prompt));
      } else {
        return {
          staticSection: currentActiveMode.system_prompt.trim(),
          semiDynamicSection: '',
          dynamicSection: '',
          fullContent: currentActiveMode.system_prompt.trim()
        };
      }
    },
    
    getCurrentConversationId: () => {
      const state = get();
      return state.chats.current?.meta.id || null;
    },
    
    addUserMessage: async (userMessage, images) => {
      if (get().audio.isSpeaking || get().audio.isGeneratingSpeech) {
        get().audioStop();
      }
      
      try {
        // Create and add user message
        const newMessage = createUserMessage(userMessage, images);
        if (newMessage.content.length > 0) {
          get().addMessage(newMessage);
          get().setIsGenerating(true);
          await get().runConversationTurnWithContext();
        }
      } catch (error) {
        console.error("Error preparing conversation turn:", error);
        new Notice(t('errors.setup', { error: error instanceof Error ? error.message : "Unknown error" }));
        get().setIsGenerating(false);
      }
    },
    
    editUserMessage: async (messageIndex, newContent, images) => {
      if (get().audio.isSpeaking || get().audio.isGeneratingSpeech) {
        get().audioStop();
      }
      
      // Validate message index
      if (messageIndex < 0 || messageIndex >= get().chats.current.storedConversation.messages.length) {
        console.error(`Invalid message index for editing: ${messageIndex}`);
        return;
      }

      const targetMessage = get().chats.current.storedConversation.messages[messageIndex];
      if (targetMessage.role !== "user") {
        console.error(`Can only edit user messages. Message at index ${messageIndex} has role: ${targetMessage.role}`);
        return;
      }

      // Abort current generation if any
      if (get().chats.isGenerating) {
        get().setIsGenerating(false);
      }

      // Truncate conversation and update the edited message
      const conversationUpToEdit = get().chats.current.storedConversation.messages.slice(0, messageIndex + 1);
      const newMessage = createUserMessage(newContent, images);
      conversationUpToEdit[messageIndex] = newMessage;
      
      set((state) => {
        state.chats.current.storedConversation.messages = conversationUpToEdit;
        state.chats.editingMessage = null;
      });

      // Trigger debounced autosave after content change
      get().saveImmediatelyIfNeeded(true);

      // Trigger new AI response if there's content
      if (newMessage.content.length > 0) {
        get().setIsGenerating(true);
        await get().runConversationTurnWithContext();
      }
    },
    
    startEditingMessage: (messageIndex) => {
      const state = get();
      if (messageIndex < 0 || messageIndex >= state.chats.current.storedConversation.messages.length) {
        console.error(`Invalid message index for editing: ${messageIndex}`);
        return;
      }

      const targetMessage = state.chats.current.storedConversation.messages[messageIndex];
      if (targetMessage.role !== "user") {
        console.error(`Can only edit user messages. Message at index ${messageIndex} has role: ${targetMessage.role}`);
        return;
      }

      const { text, images } = extractUserMessageContent(targetMessage);
      state.setEditingMessage({
        index: messageIndex,
        content: text,
        images: images
      });
    },
    
    cancelEditingMessage: () => {
      const state = get();
      state.setEditingMessage(null);
    },
    
    // Helper method for conversation turn logic
    runConversationTurnWithContext: async () => {
      abortController = new AbortController();
      const signal = abortController.signal;
      try {
        // Prepare context and tools
        const plugin = LifeNavigatorPlugin.getInstance();
        
        if (!plugin) {
          throw new Error('Plugin instance not available');
        }
        
        const obsidianTools = getObsidianTools();
        
        const currentActiveMode = get().modes.available[get().modes.activeId];
        
        // Get tools asynchronously
        const tools = currentActiveMode 
          ? await obsidianTools.getToolsForMode(currentActiveMode)
          : await obsidianTools.getTools();

        // Run conversation turn with direct store access
        const finalAssistantMessage = await runConversationTurn(
          tools,
          signal
        );

        if (!finalAssistantMessage) return;
        if (signal.aborted) return;
	
        const contentBlocks = ensureContentBlocks(finalAssistantMessage.content);
        const textForTTS = extractTextForTTS(contentBlocks);
        
        // Get current mode and check autoplay setting
        const defaultMode = getDefaultLNMode();
        const autoplayEnabled = !!currentActiveMode?.voice_autoplay;
        
        // Only auto-play if both the global setting and the mode-specific autoplay are enabled
        if (autoplayEnabled && textForTTS.trim().length > 0) {
          get().speakingStart(textForTTS);
        }
      } catch (error) {
        console.error("Error in conversation turn:", error);

        // Add error message to conversation instead of showing notice
        const errorMessage: Message = {
          role: "assistant",
          content: [{
            type: "error_message",
            text: error instanceof Error ? error.message : "Unknown error",
          }]
        };
        
        get().addMessage(errorMessage);
       
        
        // Ensure generating state is cleared even on error
        const currentState = get();
        currentState.setIsGenerating(false);
      }
    },

    chatStop: () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    },

    saveImmediatelyIfNeeded: async (force?: boolean) => {
      const needsToBeSaved = saveTimeout || force;
      
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }

      if (needsToBeSaved) {
        await get().autoSaveConversation();
      }
    },

    retryFromMessage: async (messageIndex: number) => {
      const state = get();
      
      // Validate message index
      const currentMessages = state.chats.current.storedConversation.messages;
      if (messageIndex < 0 || messageIndex >= currentMessages.length) {
        console.error(`Invalid message index for retry: ${messageIndex}`);
        return;
      }
      
      // Remove the message at the given index and all messages after it
      const messagesUpToRetry = currentMessages.slice(0, messageIndex);
      
      // Update the conversation without the message and everything after it
      set((state) => {
        state.chats.current.storedConversation.messages = messagesUpToRetry;
      });
      
      // Trigger debounced autosave after content change
      state.saveImmediatelyIfNeeded(true);
      
      // Retry the conversation
      await state.runConversationTurnWithContext();
    },

    // Cost tracking implementation
    updateCostEntry: (model: string, usage: ApiUsageData, timestamp: number, duration?: number, apiCallId?: string) => {
      set((state) => {
        // Initialize cost data if it doesn't exist
        if (!state.chats.current.storedConversation.costData) {
          state.chats.current.storedConversation.costData = {
            total_cost: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cache_write_tokens: 0,
            total_cache_read_tokens: 0,
            entries: [],
          };
        }
        
        // Calculate the cost entry with custom ID if provided
        const costEntry = calculateApiCallCost(model, usage, timestamp, duration, apiCallId);
        
        // Update the existing entry with new values
        const existingEntry = state.chats.current.storedConversation.costData?.entries.find(entry => 
          entry.id === costEntry.id
        );

        if (existingEntry) {
          existingEntry.breakdown.cache_read_cost += costEntry.breakdown.cache_read_cost;
          existingEntry.breakdown.cache_write_cost += costEntry.breakdown.cache_write_cost;
          existingEntry.breakdown.input_cost += costEntry.breakdown.input_cost;
          existingEntry.breakdown.output_cost += costEntry.breakdown.output_cost;
          existingEntry.cost += costEntry.cost;
          existingEntry.duration = costEntry.duration;
          existingEntry.usage = costEntry.usage;
        } else {
          state.chats.current.storedConversation.costData?.entries.push(costEntry);
        }

        // Recalculate totals
        const newTotals = calculateChatCostData(state.chats.current.storedConversation.costData.entries);
        state.chats.current.storedConversation.costData = newTotals;
      });
      
      // Save the conversation with the new cost data
      get().saveImmediatelyIfNeeded(true);
    }
  }
}; 