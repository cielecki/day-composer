import type { ImmerStateCreator } from '../store/plugin-store';
import { Message, ToolResultBlock, ContentBlock } from '../types/message';
import { AttachedImage } from 'src/types/attached-image';
import { Chat, CURRENT_SCHEMA_VERSION, ChatWithState, InputState, LoadedChat } from 'src/utils/chat/conversation';
import { generateChatId } from 'src/utils/chat/generate-conversation-id';
import { createUserMessage, extractUserMessageContent } from 'src/utils/chat/message-builder';
import { runConversationTurn } from 'src/utils/chat/conversation-turn';
import { getObsidianTools } from '../obsidian-tools';
import { DEFAULT_MODE_ID } from '../utils/modes/ln-mode-defaults';

import { Notice } from 'obsidian';
import { t } from 'src/i18n';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { ensureContentBlocks, extractTextForTTS } from 'src/utils/chat/content-blocks';
import { getDefaultLNMode } from 'src/utils/modes/ln-mode-defaults';
import { ApiUsageData, ChatCostData, CostEntry } from 'src/types/cost-tracking';
import { calculateApiCallCost, calculateChatCostData } from 'src/utils/cost/cost-calculator';
import { isChatCurrentlyFocused } from 'src/utils/chat/chat-focus-utils';

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
  const messageWithId = message as MessageWithId;
  if (!messageWithId.messageId) {
    messageWithId.messageId = generateMessageId();
  }
  return messageWithId;
};

// Helper to create initial chat with state
const createInitialChatWithState = (): ChatWithState => {
  return {
    chat: {
      meta: {
        id: generateChatId(),
        filePath: '',
        updatedAt: 0,
      },
      storedConversation: {
        version: CURRENT_SCHEMA_VERSION,
        title: t('chat.titles.newChat'),
        isUnread: false,
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
    } as LoadedChat, // Cast to LoadedChat since storedConversation is guaranteed to exist
    isGenerating: false,
    editingMessage: null,
    liveToolResults: new Map(),
    abortController: null,
    saveTimeout: null,

    // Audio transcription state (chat-specific)
    isTranscribing: false,
    transcriptionId: undefined,
    lastTranscription: null,

    inputState: {
      text: '',
      attachedImages: []
    },
    hasBackingFile: false
  };
};

// Chat slice interface
export interface ChatSlice {
  // State - now manages multiple loaded chats
  chats: {
    loaded: Map<string, ChatWithState>;
  };
  
  // Core chat management
  loadChat: (chatId: string) => Promise<boolean>;
  unloadChat: (chatId: string) => Promise<void>;
  createNewChat: (inheritModeId?: string) => string;
  getChatState: (chatId: string) => ChatWithState | null;
  getAllLoadedChats: () => Map<string, ChatWithState>;
  
  // Per-chat message operations
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, index: number, message: Message) => void;
  clearChat: (chatId: string) => void;
  
  // Per-chat state management
  setIsGenerating: (chatId: string, generating: boolean) => void;
  setEditingMessage: (chatId: string, editing: { index: number; content: string; images?: AttachedImage[]; modeId?: string } | null) => void;
  updateLiveToolResult: (chatId: string, toolId: string, result: ToolResultBlock) => void;
  clearLiveToolResults: (chatId: string) => void;
  setCurrentChat: (chatId: string, chat: Chat) => void;
  
  // Per-chat transcription management
  setIsTranscribing: (chatId: string, transcribing: boolean) => void;
  setTranscriptionId: (chatId: string, transcriptionId: string | undefined) => void;
  setLastTranscription: (chatId: string, transcription: string | null) => void;
  getTranscriptionState: (chatId: string) => { isTranscribing: boolean; transcriptionId?: string; lastTranscription: string | null } | null;
  
  // Per-chat business logic
  addUserMessage: (chatId: string, userMessage: string, images?: AttachedImage[]) => Promise<void>;
  editUserMessage: (chatId: string, messageIndex: number, newContent: string, images?: AttachedImage[]) => Promise<void>;
  startEditingMessage: (chatId: string, messageIndex: number) => void;
  cancelEditingMessage: (chatId: string) => void;
  runConversationTurnWithContext: (chatId: string) => Promise<void>;
  retryFromMessage: (chatId: string, messageIndex: number) => Promise<void>;
  chatStop: (chatId: string) => void;
  saveImmediatelyIfNeeded: (chatId: string, force?: boolean) => Promise<void>;
  
  // Cost tracking
  updateCostEntry: (chatId: string, model: string, usage: ApiUsageData, timestamp: number, duration?: number, apiCallId?: string) => void;
  
  // Backward compatibility helpers (these will need a chatId from component)
  getCurrentConversationId: (chatId: string) => string | null;
  reset: (chatId: string) => void; // Alias for clearChat
  
  // Per-chat mode management
  setActiveModeForChat: (chatId: string, modeId: string) => void;
  getActiveModeForChat: (chatId: string) => string | null;
  
  // Per-chat input state management
  updateInputState: (chatId: string, inputState: Partial<InputState>) => void;
  getInputState: (chatId: string) => InputState;
  clearInputState: (chatId: string) => void;
  markChatAsHavingBackingFile: (chatId: string) => void;

  markChatAsRead: (chatId: string) => void;
}

// Create conversation slice
export const createChatSlice: ImmerStateCreator<ChatSlice> = (set, get) => {
  
  // Debounced save function per chat
  const createDebouncedSave = (chatId: string) => {
    return () => {
      const chatState = get().getChatState(chatId);
      if (!chatState) return;
      
      // Clear any existing timeout
      if (chatState.saveTimeout) {
        clearTimeout(chatState.saveTimeout);
      }
      
      // Schedule new save after 2 seconds
      const timeout = setTimeout(async () => {
        const currentChatState = get().getChatState(chatId);
        if (!currentChatState) return;
        
        // Only save if there are messages and not currently generating
        if (currentChatState.chat.storedConversation.messages.length > 0 && 
            !currentChatState.isGenerating) {
          try {
            await get().autoSaveConversation(chatId);
            console.debug(`Auto-saved conversation ${chatId} after 2s debounce`);
          } catch (error) {
            console.error(`Failed to auto-save conversation ${chatId}:`, error);
          }
        }
        
        // Clear timeout reference
        set((state) => {
          const chatState = state.chats.loaded.get(chatId);
          if (chatState) {
            chatState.saveTimeout = null;
          }
        });
      }, 2000);
      
      // Store timeout reference
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (chatState) {
          chatState.saveTimeout = timeout;
        }
      });
    };
  };
  
  return {
    chats: {
      loaded: new Map(),
    },
    
    loadChat: async (chatId: string) => {
      // Check if already loaded
      if (get().chats.loaded.has(chatId)) {
        return true;
      }
      
      try {
        // Try to load from database
        const success = await get().loadConversation(chatId);
        return success;
      } catch (error) {
        console.error(`Failed to load chat ${chatId}:`, error);
        return false;
      }
    },
    
    unloadChat: async (chatId: string) => {
      const chatState = get().getChatState(chatId);
      if (!chatState) return;
      
      // Save if needed before unloading
      await get().saveImmediatelyIfNeeded(chatId, false);
      
      // Stop any ongoing generation
      get().chatStop(chatId);
      
      // Clear any pending save timeout
      if (chatState.saveTimeout) {
        clearTimeout(chatState.saveTimeout);
      }
      
      // Remove from loaded chats
      set((state) => {
        state.chats.loaded.delete(chatId);
      });
    },
    
    createNewChat: (inheritModeId?: string) => {
      const chatId = generateChatId();
      const modeId = inheritModeId || DEFAULT_MODE_ID;
      
      const newChatState = createInitialChatWithState();
      newChatState.chat.meta.id = chatId;
      newChatState.chat.storedConversation.modeId = modeId;
      
      set((state) => {
        state.chats.loaded.set(chatId, newChatState);
      });
      
      console.debug(`Created new chat with ID: ${chatId}, mode: ${modeId}`);
      return chatId;
    },
    
    getChatState: (chatId: string) => {
      return get().chats.loaded.get(chatId) || null;
    },
    
    getAllLoadedChats: () => {
      return new Map(get().chats.loaded);
    },
    
    addMessage: (chatId: string, message: Message) => {
      console.debug(`[CHAT-STORE] addMessage called for chat ${chatId}:`, message);
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (!chatState) {
          console.error(`[CHAT-STORE] Chat ${chatId} not found in addMessage`);
          return;
        }
        
        console.debug(`[CHAT-STORE] Chat ${chatId} found, current messages:`, chatState.chat.storedConversation.messages.length);
        
        // Ensure message has a unique ID for React reconciliation
        const messageWithId = ensureMessageId(message);
        
        // Create a new messages array to avoid proxy issues
        const newMessages = [...chatState.chat.storedConversation.messages, messageWithId];
        chatState.chat.storedConversation.messages = newMessages;
        
        // Mark as unread if this is an assistant message AND the chat is not currently focused
        if (message.role === 'assistant' && !isChatCurrentlyFocused(chatId)) {
          chatState.chat.storedConversation.isUnread = true;
        }

        console.debug(`[CHAT-STORE] Message added to chat ${chatId}, new count:`, newMessages.length);
      });
      
      // Trigger debounced autosave after content change
      get().saveImmediatelyIfNeeded(chatId, true);
    },
    
    updateMessage: (chatId: string, index: number, message: Message) => {
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (!chatState) return;
        
        const messages = chatState.chat.storedConversation.messages;
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
          chatState.chat.storedConversation.messages = newMessages;
        }
      });
      
      // Trigger debounced autosave after content change
      const debouncedSave = createDebouncedSave(chatId);
      debouncedSave();
    },
    
    clearChat: (chatId: string) => {
      get().chatStop(chatId);

      const chatState = get().getChatState(chatId);
      if (chatState?.saveTimeout) {
        clearTimeout(chatState.saveTimeout);
      }

      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (!chatState) return;
        
        chatState.chat = {
          meta: {
            id: chatId, // Use the same chatId, don't generate a new one
            filePath: '',
            updatedAt: 0,
          },
          storedConversation: {
            version: CURRENT_SCHEMA_VERSION,
            title: t('chat.titles.newChat'),
            isUnread: false,
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
        chatState.liveToolResults.clear();
        chatState.editingMessage = null;
        chatState.isGenerating = false;
        
        // Reset transcription state
        chatState.isTranscribing = false;
        chatState.transcriptionId = undefined;
        chatState.lastTranscription = null;
      });
    },
    
    reset: (chatId: string) => {
      get().clearChat(chatId);
    },
    
    setIsGenerating: (chatId: string, generating: boolean) => set((state) => {
      const chatState = state.chats.loaded.get(chatId);
      if (chatState) {
        chatState.isGenerating = generating;
      }
    }),
    
    setEditingMessage: (chatId: string, editing: { index: number; content: string; images?: AttachedImage[]; modeId?: string } | null) => set((state) => {
      const chatState = state.chats.loaded.get(chatId);
      if (chatState) {
        chatState.editingMessage = editing;
      }
    }),
    
    updateLiveToolResult: (chatId: string, toolId: string, result: ToolResultBlock) => set((state) => {
      const chatState = state.chats.loaded.get(chatId);
      if (chatState) {
        chatState.liveToolResults.set(toolId, result);
      }
    }),
    
    clearLiveToolResults: (chatId: string) => set((state) => {
      const chatState = state.chats.loaded.get(chatId);
      if (chatState) {
        chatState.liveToolResults.clear();
      }
    }),
    
    setCurrentChat: (chatId: string, chat: Chat) => set((state) => {
      // Ensure storedConversation exists for loaded chats
      if (!chat.storedConversation) {
        console.error(`Cannot load chat ${chatId} - storedConversation is missing`);
        return;
      }

      // Ensure all messages have IDs when loading conversation
      const messagesWithIds = chat.storedConversation.messages.map(msg => ensureMessageId(msg));
      const loadedChat: LoadedChat = {
        meta: chat.meta,
        storedConversation: {
          ...chat.storedConversation,
          messages: messagesWithIds
        }
      };
      
      // Create or update the chat state
      let chatState = state.chats.loaded.get(chatId);
      if (!chatState) {
        chatState = createInitialChatWithState();
        state.chats.loaded.set(chatId, chatState);
      }
      
      chatState.chat = loadedChat;
      
    }),
    
    getCurrentConversationId: (chatId: string) => {
      const chatState = get().getChatState(chatId);
      return chatState?.chat.meta.id || null;
    },
    
    addUserMessage: async (chatId: string, userMessage: string, images?: AttachedImage[]) => {
      console.debug(`[CHAT-STORE] addUserMessage called for chat ${chatId}`);
      const chatState = get().chats.loaded.get(chatId);
      if (!chatState) {
        console.error(`[CHAT-STORE] Chat ${chatId} not found in addUserMessage`);
        return;
      }
      
      console.debug(`[CHAT-STORE] Chat ${chatId} found in addUserMessage, conversation ID: ${chatState.chat.meta.id}`);

      // Clear input state since message is being sent
      get().clearInputState(chatId);

      // Check if this is the first message
      const isFirstMessage = chatState.chat.storedConversation.messages.length === 0;

      // Create user message with current mode
      const currentModeId = chatState.chat.storedConversation.modeId || DEFAULT_MODE_ID;
      const userMessage_ = createUserMessage(userMessage, images, currentModeId);
      
      // Add to conversation
      get().addMessage(chatId, userMessage_);

      // Mark as having backing file on first message
      if (isFirstMessage) {
        get().markChatAsHavingBackingFile(chatId);
      }

      // If this is the first message and no title is set, generate a better one from the message
      if (isFirstMessage && chatState.chat.storedConversation.title === t('chat.titles.newChat')) {
        const generatedTitle = userMessage.length > 50 ? 
          userMessage.substring(0, 47) + '...' : 
          userMessage;
        
        set((state) => {
          const chatToUpdate = state.chats.loaded.get(chatId);
          if (chatToUpdate) {
            chatToUpdate.chat.storedConversation.title = generatedTitle;
            chatToUpdate.chat.meta.updatedAt = Date.now();
          }
        });
      }

      // Save conversation if it has a backing file
      if (chatState.hasBackingFile || isFirstMessage) {
        await get().saveImmediatelyIfNeeded(chatId);
      }

      // Run AI response
      await get().runConversationTurnWithContext(chatId);
    },
    
    editUserMessage: async (chatId: string, messageIndex: number, newContent: string, images?: AttachedImage[]) => {
      const chatState = get().getChatState(chatId);
      if (!chatState) return;
      
      if (get().audio.isSpeaking || get().audio.isGeneratingSpeech) {
        get().audioStop();
      }
      
      // Validate message index
      if (messageIndex < 0 || messageIndex >= chatState.chat.storedConversation.messages.length) {
        console.error(`Invalid message index for editing: ${messageIndex}`);
        return;
      }

      const targetMessage = chatState.chat.storedConversation.messages[messageIndex];
      if (targetMessage.role !== "user") {
        console.error(`Can only edit user messages. Message at index ${messageIndex} has role: ${targetMessage.role}`);
        return;
      }

      // Abort current generation if any
      if (chatState.isGenerating) {
        get().setIsGenerating(chatId, false);
      }

      // Truncate conversation and update the edited message
      const conversationUpToEdit = chatState.chat.storedConversation.messages.slice(0, messageIndex + 1);
      // Preserve the original message's modeId when editing
      const originalModeId = targetMessage.modeId;
      const newMessage = createUserMessage(newContent, images, originalModeId);
      conversationUpToEdit[messageIndex] = newMessage;
      
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (chatState) {
          chatState.chat.storedConversation.messages = conversationUpToEdit;
          chatState.editingMessage = null;
        }
      });

      // Trigger debounced autosave after content change
      get().saveImmediatelyIfNeeded(chatId, true);

      // Trigger new AI response if there's content
      if (newMessage.content.length > 0) {
        get().setIsGenerating(chatId, true);
        await get().runConversationTurnWithContext(chatId);
      }
    },
    
    startEditingMessage: (chatId: string, messageIndex: number) => {
      const chatState = get().getChatState(chatId);
      if (!chatState) return;
      
      if (messageIndex < 0 || messageIndex >= chatState.chat.storedConversation.messages.length) {
        console.error(`Invalid message index for editing: ${messageIndex}`);
        return;
      }

      const targetMessage = chatState.chat.storedConversation.messages[messageIndex];
      if (targetMessage.role !== "user") {
        console.error(`Can only edit user messages. Message at index ${messageIndex} has role: ${targetMessage.role}`);
        return;
      }

      const { text, images } = extractUserMessageContent(targetMessage);
      get().setEditingMessage(chatId, {
        index: messageIndex,
        content: text,
        images: images,
        modeId: targetMessage.modeId // Capture original message's mode
      });
    },
    
    cancelEditingMessage: (chatId: string) => {
      get().setEditingMessage(chatId, null);
    },

    runConversationTurnWithContext: async (chatId: string) => {
      console.debug(`[CHAT-STORE] runConversationTurnWithContext called for chat ${chatId}`);
      const chatState = get().getChatState(chatId);
      if (!chatState) {
        console.error(`[CHAT-STORE] Chat ${chatId} not found in runConversationTurnWithContext`);
        return;
      }
      
      console.debug(`[CHAT-STORE] Chat ${chatId} found, conversation ID: ${chatState.chat.meta.id}`);
      
      try {
        // Create abort controller for this chat
        const newAbortController = new AbortController();
        
        set((state) => {
          const chatState = state.chats.loaded.get(chatId);
          if (chatState) {
            chatState.abortController = newAbortController;
          }
        });

                 // Get tools for the current mode
         const plugin = LifeNavigatorPlugin.getInstance();
         if (!plugin) {
           throw new Error('Plugin instance not available');
         }
         
                 const obsidianTools = getObsidianTools();
        const chatActiveModeId = chatState.chat.storedConversation.modeId || DEFAULT_MODE_ID;
        const currentActiveMode = get().modes.available[chatActiveModeId];
         const tools = currentActiveMode 
           ? await obsidianTools.getToolsForMode(currentActiveMode)
           : await obsidianTools.getTools();

         console.debug(`[CHAT-STORE] Calling runConversationTurn with chatId: ${chatId}`);
         const finalAssistantMessage = await runConversationTurn(tools, newAbortController.signal, chatId, chatActiveModeId);
        
        // Clear abort controller on success
        set((state) => {
          const chatState = state.chats.loaded.get(chatId);
          if (chatState) {
            chatState.abortController = null;
          }
        });

        // Handle voice autoplay if a final assistant message was returned
        if (finalAssistantMessage) {
          const currentChatState = get().getChatState(chatId);
          if (currentChatState) {
            const modeForAutoplay = currentChatState.chat.storedConversation.modeId || DEFAULT_MODE_ID;
            const modeForSettings = get().modes.available[modeForAutoplay];
            const voiceAutoplay = modeForSettings?.voice_autoplay ?? true;
            
            if (voiceAutoplay) {
              // Extract text content for TTS
              const textToSpeak = extractTextForTTS(finalAssistantMessage.content);
              if (textToSpeak && textToSpeak.trim().length > 0) {
                // Check if we're not currently recording or already speaking
                const audioState = get().audio;
                if (!audioState.currentRecordingWindowId && !audioState.isSpeaking && !audioState.isGeneratingSpeech) {
                  console.debug(`🔊 Voice autoplay triggered after conversation turn completion for mode '${modeForAutoplay}'`);
                  // Small delay to ensure UI is updated
                  setTimeout(() => {
                    get().speakingStart(textToSpeak, modeForAutoplay);
                  }, 100);
                }
              }
            }
          }
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
        
        get().addMessage(chatId, errorMessage);
        
        // Ensure generating state is cleared even on error
        get().setIsGenerating(chatId, false);
      }
    },

    chatStop: (chatId: string) => {
      const chatState = get().getChatState(chatId);
      if (chatState?.abortController) {
        chatState.abortController.abort();
        set((state) => {
          const chatState = state.chats.loaded.get(chatId);
          if (chatState) {
            chatState.abortController = null;
          }
        });
      }
    },

    saveImmediatelyIfNeeded: async (chatId: string, force?: boolean) => {
      const chatState = get().getChatState(chatId);
      if (!chatState) return;
      
      const needsToBeSaved = chatState.saveTimeout || force;
      
      if (chatState.saveTimeout) {
        clearTimeout(chatState.saveTimeout);
        set((state) => {
          const chatState = state.chats.loaded.get(chatId);
          if (chatState) {
            chatState.saveTimeout = null;
          }
        });
      }

      if (needsToBeSaved) {
        await get().autoSaveConversation(chatId);
      }
    },

    retryFromMessage: async (chatId: string, messageIndex: number) => {
      const chatState = get().getChatState(chatId);
      if (!chatState) return;
      
      // Validate message index
      const currentMessages = chatState.chat.storedConversation.messages;
      if (messageIndex < 0 || messageIndex >= currentMessages.length) {
        console.error(`Invalid message index for retry: ${messageIndex}`);
        return;
      }
      
      // Remove the message at the given index and all messages after it
      const messagesUpToRetry = currentMessages.slice(0, messageIndex);
      
      // Update the conversation without the message and everything after it
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (chatState) {
          chatState.chat.storedConversation.messages = messagesUpToRetry;
        }
      });
      
      // Trigger debounced autosave after content change
      get().saveImmediatelyIfNeeded(chatId, true);
      
      // Retry the conversation
      await get().runConversationTurnWithContext(chatId);
    },

    // Cost tracking implementation
    updateCostEntry: (chatId: string, model: string, usage: ApiUsageData, timestamp: number, duration?: number, apiCallId?: string) => {
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (!chatState) return;
        
        // Initialize cost data if it doesn't exist
        if (!chatState.chat.storedConversation.costData) {
          chatState.chat.storedConversation.costData = {
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
        const existingEntry = chatState.chat.storedConversation.costData?.entries.find(entry => 
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
          chatState.chat.storedConversation.costData?.entries.push(costEntry);
        }

        // Recalculate totals
        const newTotals = calculateChatCostData(chatState.chat.storedConversation.costData.entries);
        chatState.chat.storedConversation.costData = newTotals;
      });
      
      // Save the conversation with the new cost data
      get().saveImmediatelyIfNeeded(chatId, true);
    },

    setActiveModeForChat: (chatId: string, modeId: string) => {
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (chatState) {
          chatState.chat.storedConversation.modeId = modeId;
        } else {
          console.warn('setActiveModeForChat: Chat state not found for chatId:', chatId);
        }
      });
    },

    getActiveModeForChat: (chatId: string) => {
      const chatState = get().chats.loaded.get(chatId);
      return chatState?.chat.storedConversation.modeId || null;
    },

    updateInputState: (chatId: string, inputState: Partial<InputState>) => {
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (chatState) {
          Object.assign(chatState.inputState, inputState);
        }
      });
      
      // Trigger debounced autosave after input state change
      const debouncedSave = createDebouncedSave(chatId);
      debouncedSave();
    },

    getInputState: (chatId: string) => {
      const chatState = get().chats.loaded.get(chatId);
      return chatState?.inputState || { text: '', attachedImages: [] };
    },

    clearInputState: (chatId: string) => {
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (chatState) {
          chatState.inputState = { text: '', attachedImages: [] };
        }
      });
    },

    markChatAsHavingBackingFile: (chatId: string) => {
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (chatState) {
          chatState.hasBackingFile = true;
        }
      });

    },

    markChatAsRead: (chatId: string) => {
      console.debug(`[CHAT-STORE] markChatAsRead called for chat ${chatId}`);
      
      set((state) => {
        const chatState = state.chats.loaded.get(chatId);
        if (chatState) {
          const wasUnread = chatState.chat.storedConversation.isUnread;
          chatState.chat.storedConversation.isUnread = false;
          console.debug(`[CHAT-STORE] Chat ${chatId} marked as read. Was unread: ${wasUnread}`);
        } else {
          console.error(`[CHAT-STORE] Chat ${chatId} not found in markChatAsRead`);
        }
      });
      
      // Save to update the filename (remove -U suffix)
      get().saveImmediatelyIfNeeded(chatId, false);
    },

    // Per-chat transcription management implementations
    setIsTranscribing: (chatId: string, transcribing: boolean) => set((state) => {
      const chatState = state.chats.loaded.get(chatId);
      if (chatState) {
        chatState.isTranscribing = transcribing;
      }
    }),

    setTranscriptionId: (chatId: string, transcriptionId: string | undefined) => set((state) => {
      const chatState = state.chats.loaded.get(chatId);
      if (chatState) {
        chatState.transcriptionId = transcriptionId;
      }
    }),

    setLastTranscription: (chatId: string, transcription: string | null) => set((state) => {
      const chatState = state.chats.loaded.get(chatId);
      if (chatState) {
        chatState.lastTranscription = transcription;
      }
    }),

    getTranscriptionState: (chatId: string) => {
      const chatState = get().chats.loaded.get(chatId);
      if (!chatState) return null;
      return {
        isTranscribing: chatState.isTranscribing,
        transcriptionId: chatState.transcriptionId,
        lastTranscription: chatState.lastTranscription,
      };
    },
  }
}; 