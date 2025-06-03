import { StateCreator } from 'zustand';
import { Message, ToolResultBlock } from '../utils/chat/types';
import { Chat } from '../utils/chat/conversation';
import { generateChatId } from '../utils/chat/generate-conversation-id';

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
  
  // Actions
  addMessage: (message: Message) => void;
  updateMessage: (index: number, message: Message) => void;
  clearChat: () => void;
  setIsGenerating: (generating: boolean) => void;
  setEditingMessage: (editing: { index: number; content: string; images?: any[] } | null) => void;
  updateLiveToolResult: (toolId: string, result: ToolResultBlock) => void;
  clearLiveToolResults: () => void;
  incrementChatVersion: () => void;
  setCurrentChat: (chat: Chat) => void;
}

// Type for StateCreator with immer middleware
type ImmerStateCreator<T> = StateCreator<
  T,
  [["zustand/immer", never]],
  [],
  T
>;

// Create conversation slice
export const createChatSlice: ImmerStateCreator<ChatSlice> = (set) => ({
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
    state.chats.current.storedConversation.messages.push(message);
    state.chats.conversationVersion += 1;
  }),
  
  updateMessage: (index, message) => set((state) => {
    const messages = state.chats.current.storedConversation.messages;
    if (index >= 0 && index < messages.length) {
      messages[index] = message;
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
    state.chats.current = conversation;
    state.chats.conversationVersion += 1;
  })
}); 