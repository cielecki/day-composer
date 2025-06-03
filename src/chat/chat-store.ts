import { StateCreator } from 'zustand';
import type { PluginStore } from '../store/plugin-store';
import { Message, ToolResultBlock } from '../utils/chat/types';
import { Chat } from '../utils/chat/conversation';
import { generateChatId } from '../utils/chat/generate-conversation-id';
import { ConversationDatabase } from '../services/conversation-database';
import { createUserMessage, extractUserMessageContent } from '../utils/chat/message-builder';
import { runConversationTurn } from '../utils/chat/conversation-turn';
import { handleTTS } from '../utils/chat/tts-integration';
import { getObsidianTools } from '../obsidian-tools';
import { expandLinks } from '../utils/links/expand-links';
import { Notice } from 'obsidian';
import { t } from '../i18n';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { generateConversationTitle } from '../utils/chat/generate-conversation-title';

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
    editingMessage: { index: number; content: string; images?: any[] } | null;
    liveToolResults: Map<string, ToolResultBlock>;
    conversationVersion: number;
  };
  
  // Basic Actions
  addMessage: (message: Message) => void;
  updateMessage: (index: number, message: Message) => void;
  clearChat: () => void;
  reset: () => void; // Alias for clearChat to match AIAgentContext
  setIsGenerating: (generating: boolean) => void;
  setEditingMessage: (editing: { index: number; content: string; images?: any[] } | null) => void;
  updateLiveToolResult: (toolId: string, result: ToolResultBlock) => void;
  clearLiveToolResults: () => void;
  incrementChatVersion: () => void;
  setCurrentChat: (chat: Chat) => void;
  
  // Business Logic Actions
  addUserMessage: (userMessage: string, signal: AbortSignal, images?: any[]) => Promise<void>;
  editUserMessage: (messageIndex: number, newContent: string, signal: AbortSignal, images?: any[]) => Promise<void>;
  getCurrentConversationId: () => string | null;
  getConversationDatabase: () => ConversationDatabase | null;
  getContext: () => Promise<string>;
  startEditingMessage: (messageIndex: number) => void;
  cancelEditingMessage: () => void;
  runConversationTurnWithContext: (signal: AbortSignal) => Promise<void>;

  // Conversation Persistence Actions
  autoSaveConversation: (isGeneratingResponse: boolean) => Promise<void>;
  saveConversationImmediately: () => Promise<void>;
  saveCurrentConversation: (title?: string, tags?: string[]) => Promise<string | null>;
  loadConversation: (conversationId: string) => Promise<boolean>;
}

// Type for StateCreator with immer middleware - updated to use PluginStore
type ImmerStateCreator<T> = StateCreator<
  PluginStore,
  [["zustand/immer", never]],
  [],
  T
>;

// Create conversation slice - now get() returns full PluginStore type
export const createChatSlice: ImmerStateCreator<ChatSlice> = (set, get) => ({
  chats: {
    current: {
      meta: {
        id: generateChatId(),
        title: '',
        filePath: '',
        updatedAt: 0
      },
      storedConversation: {
        version: 0,
        modeId: '',
        titleGenerated: false,
        messages: []
      }
    },
    isGenerating: false,
    editingMessage: null,
    liveToolResults: new Map(),
    conversationVersion: 0
  },
  
  addMessage: (message) => set((state) => {
    // Ensure message has a unique ID for React reconciliation
    const messageWithId = ensureMessageId(message);
    
    // Create a new messages array to avoid proxy issues
    const newMessages = [...state.chats.current.storedConversation.messages, messageWithId];
    state.chats.current.storedConversation.messages = newMessages;
    state.chats.conversationVersion += 1;
  }),
  
  updateMessage: (index, message) => set((state) => {
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
      state.chats.conversationVersion += 1;
    }
  }),
  
  clearChat: () => set((state) => {
    state.chats.current = {
      meta: {
        id: generateChatId(),
        title: '',
        filePath: '',
        updatedAt: 0
      },
      storedConversation: {
        version: 0,
        modeId: '',
        titleGenerated: false,
        messages: []
      }
    };
    state.chats.liveToolResults.clear();
    state.chats.editingMessage = null;
    state.chats.conversationVersion += 1;
  }),
  
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
  
  incrementChatVersion: () => set((state) => {
    state.chats.conversationVersion += 1;
  }),
  
  setCurrentChat: (conversation) => set((state) => {
    // Ensure all messages have IDs when loading conversation
    const messagesWithIds = conversation.storedConversation.messages.map(msg => ensureMessageId(msg));
    const conversationWithIds = {
      ...conversation,
      storedConversation: {
        ...conversation.storedConversation,
        messages: messagesWithIds
      }
    };
    
    state.chats.current = conversationWithIds;
    state.chats.conversationVersion += 1;
  }),
  
  // Business Logic Implementation
  getContext: async () => {
    const state = get();
    
    const currentActiveMode = state.modes.available[state.modes.activeId];
    const plugin = LifeNavigatorPlugin.getInstance();
    
    if (!currentActiveMode || !plugin) {
      return '';
    }
    
    // Conditionally expand links based on mode setting
    if (currentActiveMode.ln_expand_links) {
      return (await expandLinks(plugin.app, currentActiveMode.ln_system_prompt)).trim();
    } else {
      return currentActiveMode.ln_system_prompt.trim();
    }
  },
  
  getCurrentConversationId: () => {
    const state = get();
    return state.chats.current?.meta.id || null;
  },
  
  getConversationDatabase: () => {
    // Use the static plugin instance method
    return LifeNavigatorPlugin.getConversationDatabase();
  },
  
  addUserMessage: async (userMessage, signal, images) => {
    const state = get();
    try {
      // Create and add user message
      const newMessage = createUserMessage(userMessage, images);
      if (newMessage.content.length > 0) {
        state.addMessage(newMessage);
        state.setIsGenerating(true);
        await state.runConversationTurnWithContext(signal);
      }
    } catch (error) {
      console.error("Error preparing conversation turn:", error);
      new Notice(t('errors.setup', { error: error instanceof Error ? error.message : "Unknown error" }));
      state.setIsGenerating(false);
    }
  },
  
  editUserMessage: async (messageIndex, newContent, signal, images) => {
    const state = get();
    
    // Validate message index
    if (messageIndex < 0 || messageIndex >= state.chats.current.storedConversation.messages.length) {
      console.error(`Invalid message index for editing: ${messageIndex}`);
      return;
    }

    const targetMessage = state.chats.current.storedConversation.messages[messageIndex];
    if (targetMessage.role !== "user") {
      console.error(`Can only edit user messages. Message at index ${messageIndex} has role: ${targetMessage.role}`);
      return;
    }

    // Abort current generation if any
    if (state.chats.isGenerating) {
      state.setIsGenerating(false);
    }

    // Truncate conversation and update the edited message
    const conversationUpToEdit = state.chats.current.storedConversation.messages.slice(0, messageIndex + 1);
    const newMessage = createUserMessage(newContent, images);
    conversationUpToEdit[messageIndex] = newMessage;
    
    set((state) => {
      state.chats.current.storedConversation.messages = conversationUpToEdit;
      state.chats.editingMessage = null;
      state.chats.conversationVersion += 1;
    });

    // Trigger new AI response if there's content
    if (newMessage.content.length > 0) {
      state.setIsGenerating(true);
      await state.runConversationTurnWithContext(signal);
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
  
  // Conversation Persistence Actions
  autoSaveConversation: async (isGeneratingResponse) => {
    const state = get();
    
    if (state.chats.current.storedConversation.messages.length > 0 && !isGeneratingResponse) {
      try {
        const database = state.getConversationDatabase();
        if (!database) return;

        // Update conversation with current mode before saving
        set((state) => {
          state.chats.current.storedConversation.modeId = state.modes.activeId;
        });

        const conversationId = await database.saveConversation(state.chats.current);
        console.log(`Auto-saved conversation: ${conversationId}`);
      } catch (error) {
        console.error('Failed to auto-save conversation:', error);
      }
    }
  },

  saveConversationImmediately: async () => {
    try {
      const state = get();
      const database = state.getConversationDatabase();
      if (!database) return;

      // Update conversation state with mode and title generation
      set((state) => {
        const currentMode = state.modes.available[state.modes.activeId];
        state.chats.current.storedConversation.modeId = currentMode?.ln_path || state.modes.activeId;

        // Set default title if needed
        if (!state.chats.current.meta.title) {
          state.chats.current.meta.title = "New Chat";
        }
      });

      // Generate title if needed (async operation, do outside of set)
      const currentState = get();
      if (!currentState.chats.current.storedConversation.titleGenerated && 
          currentState.chats.current.storedConversation.messages.length >= 2) {
        const title = await generateConversationTitle(currentState.chats.current.storedConversation.messages);
        
        set((state) => {
          state.chats.current.meta.title = title;
          state.chats.current.storedConversation.titleGenerated = true;
        });
      }

      const updatedState = get();
      await database.saveConversation(updatedState.chats.current);
      
      console.log(`Immediately saved conversation with title: ${updatedState.chats.current.meta.title}`);
    } catch (error) {
      console.error('Failed to immediately save conversation:', error);
    }
  },

  saveCurrentConversation: async (title, tags) => {
    try {
      const state = get();
      const database = state.getConversationDatabase();
      if (!database) return null;

      // Update conversation state
      set((state) => {
        state.chats.current.storedConversation.modeId = state.modes.activeId;
        
        // Apply custom title if provided
        if (title) {
          state.chats.current.meta.title = title;
        }
      });

      const updatedState = get();
      const conversationId = await database.saveConversation(updatedState.chats.current);
      
      new Notice('Conversation saved successfully');
      return conversationId;
    } catch (error) {
      console.error('Failed to save conversation:', error);
      new Notice('Failed to save conversation');
      return null;
    }
  },

  loadConversation: async (conversationId) => {
    try {
      const database = get().getConversationDatabase();
      if (!database) {
        return false;
      }

      // Load the stored conversation data
      const storedConversation = await database.loadConversation(conversationId);
      
      if (!storedConversation) {
        new Notice('Conversation not found');
        return false;
      }

      // Get metadata for the conversation
      const meta = await database.getConversationMeta(conversationId);
      
      if (!meta) {
        new Notice('Conversation metadata not found');
        return false;
      }

      // Reconstruct the full conversation object
      const conversation: Chat = {
        meta: meta,
        storedConversation: storedConversation
      };

      // Load the conversation into the current state
      get().setCurrentChat(conversation);
      
      return true;
    } catch (error) {
      console.error('Failed to load conversation:', error);
      new Notice('Failed to load conversation');
      return false;
    }
  },
  
  // Helper method for conversation turn logic
  runConversationTurnWithContext: async (signal: AbortSignal) => {
    const state = get();
    try {
      // Prepare context and tools
      const systemPrompt = await state.getContext();
      const plugin = LifeNavigatorPlugin.getInstance();
      
      if (!plugin) {
        throw new Error('Plugin instance not available');
      }
      
      const obsidianTools = getObsidianTools(plugin);
      
      const currentActiveMode = state.modes.available[state.modes.activeId];
      
      // Get tools asynchronously
      const tools = currentActiveMode 
        ? await obsidianTools.getToolsForMode(currentActiveMode)
        : await obsidianTools.getTools();

      // Run conversation turn with direct store access
      const finalAssistantMessage = await runConversationTurn(
        systemPrompt,
        tools,
        signal
      );

      // Handle TTS
      await handleTTS(finalAssistantMessage, signal);
    } catch (error) {
      console.error("Error in conversation turn:", error);
      new Notice(t('errors.setup', { error: error instanceof Error ? error.message : "Unknown error" }));
      // Ensure generating state is cleared even on error
      const currentState = get();
      currentState.setIsGenerating(false);
    }
  }
}); 