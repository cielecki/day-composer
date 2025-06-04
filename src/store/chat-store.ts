import type { ImmerStateCreator } from '../store/plugin-store';
import { Message, ToolResultBlock } from '../types/chat-types';
import { Chat } from 'src/utils/chat/conversation';
import { generateChatId } from 'src/utils/chat/generate-conversation-id';
import { createUserMessage, extractUserMessageContent } from 'src/utils/chat/message-builder';
import { runConversationTurn } from 'src/utils/chat/conversation-turn';
import { handleTTS } from 'src/utils/chat/tts-integration';
import { getObsidianTools } from '../obsidian-tools';
import { expandLinks } from 'src/utils/links/expand-links';
import { Notice } from 'obsidian';
import { t } from 'src/i18n';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';

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
  autoSaveConversation: async (isGeneratingResponse: boolean) => {
    const state = get();
    
    if (state.chats.current.storedConversation.messages.length > 0 && !isGeneratingResponse) {
      await state.autoSaveConversation();
    }
  },

  saveConversationImmediately: async () => {
    const state = get();
    await state.saveConversation();
  },

  saveCurrentConversation: async (title?: string, tags?: string[]) => {
    const state = get();
    return await state.saveConversation(undefined, title, tags);
  },

  loadConversation: async (conversationId: string) => {
    const state = get();
    return await state.loadConversation(conversationId);
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