import type { ImmerStateCreator } from './plugin-store';
import { ConversationMeta, StoredConversation, Chat, ConversationListItem } from '../utils/chat/conversation';
import { generateChatTitle } from '../utils/chat/generate-conversation-title';
import { Notice } from 'obsidian';
import { t } from '../i18n';
import { DEFAULT_MODE_ID } from '../utils/modes/ln-mode-defaults';

export interface ChatsDatabaseSlice {
  // State
  database: {
    isInitialized: boolean;
  };
  
  // Global conversation list cache for virtual scrolling
  conversationList: {
    items: ConversationListItem[];
    isLoaded: boolean;
    lastRefreshTime: number;
  };
  
  // Database Actions (migrated from ConversationDatabase)
  initializeDatabase: () => Promise<void>;
  saveConversation: (chatId?: string) => Promise<string | null>;
  loadConversation: (conversationId: string) => Promise<boolean>;
  loadConversationData: (conversationId: string) => Promise<StoredConversation | null>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  autoSaveConversation: (chatId?: string) => Promise<void>;
  listConversations: () => Promise<ConversationMeta[]>;
  searchConversations: (query: string) => Promise<ConversationMeta[]>;
  updateConversationTitle: (conversationId: string, title: string) => Promise<boolean>;
  getConversationMeta: (conversationId: string) => Promise<ConversationMeta | null>;
  
  // New virtual scrolling methods
  loadConversationMetadata: (conversationId: string) => Promise<ConversationMeta | null>;
  
  // Global conversation list management
  refreshConversationList: () => Promise<void>;
  updateConversationInList: (conversationId: string, updates: Partial<ConversationListItem>) => void;
  markConversationMetadataLoaded: (conversationId: string, metadata: ConversationMeta) => void;
  markConversationFullyLoaded: (conversationId: string) => void;
  removeConversationFromList: (conversationId: string) => void;
  
  // Helper methods
  getConversationDatabase: () => null; // Deprecated - functionality moved to this slice
}

export const createChatsDatabaseSlice: ImmerStateCreator<ChatsDatabaseSlice> = (set, get) => {
  
  const getApp = () => {
    const app = (window as any).app;
    if (!app) throw new Error('Obsidian app not available');
    return app;
  };

  const getConversationsDir = () => {
    const app = getApp();
    const pluginDir = app.vault.configDir + '/plugins/life-navigator';
    return pluginDir + '/conversations';
  };

  const getConversationFiles = async (): Promise<string[]> => {
    const app = getApp();
    const conversationsDir = getConversationsDir();
    
    try {
      const files = await app.vault.adapter.list(conversationsDir);
      return files.files
        .filter((file: string) => file.endsWith('.json'))
        .map((file: string) => file.split('/').pop() || file);
    } catch (error) {
      console.warn('Conversations directory does not exist yet');
      return [];
    }
  };

  return {
    database: {
      isInitialized: false,
    },
    
    conversationList: {
      items: [],
      isLoaded: false,
      lastRefreshTime: 0,
    },

    getConversationDatabase: () => {
      // Deprecated - functionality moved to this slice
      return null;
    },

    initializeDatabase: async () => {
      try {
        const app = getApp();
        const conversationsDir = getConversationsDir();
        
        // Ensure conversations directory exists
        try {
          await app.vault.adapter.stat(conversationsDir);
        } catch (error) {
          await app.vault.adapter.mkdir(conversationsDir);
        }

        set((state) => {
          state.database.isInitialized = true;
        });
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    },

    saveConversation: async (chatId?: string) => {
      try {
        const app = getApp();
        const conversationsDir = getConversationsDir();

        if (!chatId) {
          console.error('[DATABASE] saveConversation requires a chatId parameter');
          return null;
        }

        console.debug(`[DATABASE] saveConversation called for chat ${chatId}`);
        const chatState = get().getChatState(chatId);
        if (!chatState) {
          console.error(`[DATABASE] Chat ${chatId} not found in loaded chats`);
          return null;
        }
        
        console.debug(`[DATABASE] Chat ${chatId} found, conversation ID: ${chatState.chat.meta.id}, messages: ${chatState.chat.storedConversation.messages.length}`);

        // Prepare the conversation within the store action
        set((state) => {
          const chatState = state.chats.loaded.get(chatId);
          if (chatState) {
            // Set the mode ID to this chat's specific mode (not global mode)
            chatState.chat.storedConversation.modeId = chatState.activeModeId || DEFAULT_MODE_ID;
          }
        });

        // Handle title generation if needed (async operation)
        if (!chatState.chat.storedConversation.titleGenerated && 
          chatState.chat.storedConversation.messages.length >= 2) {
            console.debug("Generating title", chatState.chat.storedConversation.messages.length);
        
            const generatedTitle = await generateChatTitle(
              chatState.chat.storedConversation.messages
            );
            
            set((state) => {
              const chatState = state.chats.loaded.get(chatId);
              if (chatState) {
                chatState.chat.storedConversation.title = generatedTitle;
                chatState.chat.storedConversation.titleGenerated = true;
              }
            });
          }

        // Get the prepared conversation and save it
        const finalChatState = get().getChatState(chatId);
        if (!finalChatState) {
          console.error(`Chat ${chatId} not found after preparation`);
          return null;
        }
        
        const conversation = finalChatState.chat;

        // Check for existing conversation and clean up old files
        let existingConversation: StoredConversation | null = null;
        try {
          existingConversation = await get().loadConversationData(conversation.meta.id);
        } catch (error) {
          // Ignore error if conversation doesn't exist yet
        }

        // Simple filename: just the ID
        const fileName = `${conversationsDir}/${conversation.meta.id}.json`;

        // Ensure stored conversation has all metadata
        const storedConversation: StoredConversation = {
          ...conversation.storedConversation,
        };

        // Save the conversation
        const conversationData = JSON.stringify(storedConversation, null, 2);
        console.debug(`Attempting to save conversation to: ${fileName}`);
        await app.vault.adapter.write(fileName, conversationData);
        console.debug(`Successfully saved conversation: ${fileName}`);

        set((state) => {
          const chatState = state.chats.loaded.get(chatId);
          if (chatState) {
            chatState.chat.meta.filePath = fileName;

            chatState.chat.meta.updatedAt = Date.now();
          }
        });
        
        // Update the conversation list with the new timestamp and title
        get().updateConversationInList(conversation.meta.id, {
          updatedAt: Date.now(),
          title: conversation.storedConversation.title,
          isUnread: conversation.storedConversation.isUnread,
          filePath: fileName
        });
        
        return conversation.meta.id;
      } catch (error) {
        console.error('Failed to save conversation:', error);
        return null;
      }
    },

    // Helper method to load conversation data (used internally)
    loadConversationData: async (conversationId: string): Promise<StoredConversation | null> => {
      try {
        const app = getApp();
        const conversationsDir = getConversationsDir();
        const newFormatPath = `${conversationsDir}/${conversationId}.json`;
        
        // First, try to load from new format
        try {
          const conversationData = await app.vault.adapter.read(newFormatPath);
          const storedConversation: StoredConversation = JSON.parse(conversationData);
          return storedConversation;
        } catch (error) {
          // New format file doesn't exist, look for old format files
          console.debug(`New format file not found for ${conversationId}, checking for old format...`);
        }
        
        // Look for old format files that start with this conversation ID
        const files = await app.vault.adapter.list(conversationsDir);
        const oldFormatFile = files.files?.find((file: string) => {
          const filename = file.split('/').pop();
          return filename?.startsWith(`${conversationId}-`) && filename.endsWith('.json');
        });
        
        if (!oldFormatFile) {
          console.debug(`No old or new format file found for conversation ${conversationId}`);
          return null;
        }
        
        // Parse old format filename to extract metadata
        const filename = oldFormatFile.split('/').pop()!;
        console.log(`🔄 Migrating old conversation file: ${filename}`);
        
        const nameWithoutExt = filename.slice(0, -5); // Remove .json
        const dashIndex = nameWithoutExt.indexOf('-');
        const remainingPart = nameWithoutExt.substring(dashIndex + 1);
        
        // Check if it ends with -U (unread flag)
        let escapedTitle: string;
        let isUnread = false;
        
        if (remainingPart.endsWith('-U')) {
          escapedTitle = remainingPart.slice(0, -2); // Remove -U
          isUnread = true;
        } else {
          escapedTitle = remainingPart;
          isUnread = false;
        }
        
        // Unescape title
        const title = escapedTitle
          .replace(/_/g, ' ')
          .replace(/·/g, '.'); // Convert middle dots back to regular dots
        
        // Load the old format file
        const oldConversationData = await app.vault.adapter.read(oldFormatFile);
        const oldStoredConversation = JSON.parse(oldConversationData);
        
        // Create migrated conversation with metadata embedded
        const migratedConversation: StoredConversation = {
          ...oldStoredConversation,
          id: conversationId,
          title: title,
          isUnread: isUnread,
          version: 3 // Update to current schema version
        };
        
        // Save in new format
        await app.vault.adapter.write(newFormatPath, JSON.stringify(migratedConversation, null, 2));
        console.log(`✅ Migrated conversation: ${filename} → ${conversationId}.json`);
        
        // Remove old format file
        await app.vault.adapter.remove(oldFormatFile);
        console.log(`🗑️ Removed old format file: ${filename}`);
        
        return migratedConversation;
        
      } catch (error) {
        console.error(`Failed to load conversation ${conversationId}:`, error);
        return null;
      }
    },

    autoSaveConversation: async (chatId?: string) => {
      // For backward compatibility, if no chatId provided, save all loaded chats
      if (!chatId) {
        const loadedChats = get().chats.loaded;
        for (const [id, chatState] of loadedChats) {
          // Only auto-save if there are messages and not currently generating
          if (chatState.chat.storedConversation.messages.length === 0 || chatState.isGenerating) {
            continue;
          }
          
          try {
            const conversationId = await get().saveConversation(id);
            if (conversationId) {
              console.debug(`Auto-saved conversation: ${conversationId}`);
            }
          } catch (error) {
            console.error(`Failed to auto-save conversation ${id}:`, error);
          }
        }
        return;
      }

      // Only auto-save if there are messages and not currently generating
      const chatState = get().getChatState(chatId);
      if (!chatState || chatState.chat.storedConversation.messages.length === 0 || chatState.isGenerating) {
        return;
      }
      
      try {
        const conversationId = await get().saveConversation(chatId);
        if (conversationId) {
          console.debug(`Auto-saved conversation: ${conversationId}`);
        }
      } catch (error) {
        console.error('Failed to auto-save conversation:', error);
      }
    },

    loadConversation: async (conversationId) => {
      try {
        // Check if the requested conversation is already loaded
        const loadedChats = get().chats.loaded;
        for (const [chatId, chatState] of loadedChats) {
          if (chatState.chat.meta.id === conversationId) {
            console.debug(`Conversation ${conversationId} is already loaded as chat ${chatId}, skipping disk load`);
            return true;
          }
        }

        // Load the stored conversation data
        const storedConversation = await get().loadConversationData(conversationId);
        
        if (!storedConversation) {
          console.warn(`Conversation ${conversationId} not found`);
          return false;
        }


        // Extract metadata from stored conversation
        const app = getApp();
        const conversationsDir = getConversationsDir();
        const filepath = `${conversationsDir}/${conversationId}.json`;
        const stat = await app.vault.adapter.stat(filepath);

        const meta: ConversationMeta = {
          id: conversationId,
          filePath: filepath,
          updatedAt: stat?.mtime || 0,
        };

        // Reconstruct the full conversation object and load it
        const chat: Chat = {
          meta: meta,
          storedConversation: storedConversation
        };

        // Load the conversation into a new chat using the conversation ID as chat ID
        get().setCurrentChat(conversationId, chat);
        
        // Restore the mode that was active for this conversation
        if (storedConversation.modeId) {
          get().setActiveModeForChat(conversationId, storedConversation.modeId);
        }
        
        return true;
      } catch (error) {
        console.error('Failed to load conversation:', error);
        new Notice(t('ui.chat.conversationLoadFailed'));
        return false;
      }
    },

    deleteConversation: async (conversationId) => {
      try {
        const app = getApp();
        const conversationsDir = getConversationsDir();
        const filepath = `${conversationsDir}/${conversationId}.json`;
        
        await app.vault.adapter.remove(filepath);
        
        // If we have any loaded chats with this conversation ID, unload them
        const loadedChats = get().chats.loaded;
        for (const [chatId, chatState] of loadedChats) {
          if (chatState.chat.meta.id === conversationId) {
            await get().unloadChat(chatId);
          }
        }
        
        // Remove from conversation list
        get().removeConversationFromList(conversationId);
        
        new Notice(t('ui.chat.conversationDeleted'));
        return true;
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        new Notice(t('ui.chat.conversationDeleteFailed'));
        return false;
      }
    },

    listConversations: async () => {
      try {
        const app = getApp();
        const conversationsDir = getConversationsDir();
        const files = await getConversationFiles();
        const conversations: ConversationMeta[] = [];

        // Process each file to get metadata from file contents
        for (const filename of files) {
          try {
            const conversationId = filename.replace('.json', '');
            const filepath = `${conversationsDir}/${filename}`;
            
            // Get filesystem metadata
            const stat = await app.vault.adapter.stat(filepath);
            
            // Create conversation metadata
            const meta: ConversationMeta = {
              id: conversationId, // Fallback for old format
              filePath: filepath,
              updatedAt: stat?.mtime || 0,
            };

            conversations.push(meta);
          } catch (error) {
            console.error(`Failed to process conversation file ${filename}:`, error);
          }
        }

        // Sort by update time (most recent first)
        conversations.sort((a, b) => b.updatedAt - a.updatedAt);
        
        return conversations;
      } catch (error) {
        console.error('Failed to list conversations:', error);
        return [];
      }
    },

    getConversationMeta: async (conversationId) => {
      try {
        const app = getApp();
        const conversationsDir = getConversationsDir();
        const filepath = `${conversationsDir}/${conversationId}.json`;
        
        // Get filesystem metadata
        const stat = await app.vault.adapter.stat(filepath);
        
        const meta: ConversationMeta = {
          id: conversationId,
          filePath: filepath,
          updatedAt: stat?.mtime || 0,
        };

        return meta;
      } catch (error) {
        console.error(`Failed to get conversation metadata ${conversationId}:`, error);
        return null;
      }
    },

    searchConversations: async (query) => {
      try {
        const conversations = get().conversationList.items;
        const lowercaseQuery = query.toLowerCase();
        
        return conversations.filter(conv => 
          conv.title?.toLowerCase().includes(lowercaseQuery)
        );
      } catch (error) {
        console.error('Failed to search conversations:', error);
        return [];
      }
    },

    updateConversationTitle: async (conversationId, title) => {
      try {
        const app = getApp();
        const conversationsDir = getConversationsDir();
        const filepath = `${conversationsDir}/${conversationId}.json`;
        
        // Read the conversation data
        const conversationData = await app.vault.adapter.read(filepath);
        const storedConversation: StoredConversation = JSON.parse(conversationData);
        
        // Update title in stored conversation
        storedConversation.title = title;
        
        // Write back to same file
        await app.vault.adapter.write(filepath, JSON.stringify(storedConversation, null, 2));
        
        // If this conversation is loaded in any chat, update the local state too
        const loadedChats = get().chats.loaded;
        for (const [chatId, chatState] of loadedChats) {
          if (chatState.chat.meta.id === conversationId) {
            set((state) => {
              const chatState = state.chats.loaded.get(chatId);
              if (chatState) {
                chatState.chat.storedConversation.title = title;
                chatState.chat.meta.updatedAt = Date.now();
              }
            });
          }
        }

        // Update the conversation list
        get().updateConversationInList(conversationId, {
          title: title,
          updatedAt: Date.now()
        });
        
        new Notice(t('ui.chat.conversationTitleUpdated'));
        return true;
      } catch (error) {
        console.error('Failed to update conversation title:', error);
        new Notice(t('ui.chat.conversationTitleUpdateFailed'));
        return false;
      }
    },

    loadConversationMetadata: async (conversationId: string): Promise<ConversationMeta | null> => {
      try {
        // First check if conversation is already loaded in memory
        const loadedChats = get().chats.loaded;
        for (const [chatId, chatState] of loadedChats) {
          if (chatState.chat.meta.id === conversationId) {
            return {
              id: chatState.chat.meta.id,
              filePath: chatState.chat.meta.filePath,
              updatedAt: chatState.chat.meta.updatedAt
            };
          }
        }
        
        // If not in memory, try to read from file
        const app = getApp();
        const conversationsDir = getConversationsDir();
        const newFormatPath = `${conversationsDir}/${conversationId}.json`;
        
        // First, try to load from new format
        try {
          const conversationData = await app.vault.adapter.read(newFormatPath);
          const storedConversation: StoredConversation = JSON.parse(conversationData);
          const stat = await app.vault.adapter.stat(newFormatPath);
          
          return {
            id: conversationId,
            filePath: newFormatPath,
            updatedAt: stat?.mtime || 0,
          };
        } catch (error) {
          // New format file doesn't exist, look for old format files
        }
        
        // Look for old format files that start with this conversation ID
        const files = await app.vault.adapter.list(conversationsDir);
        const oldFormatFile = files.files?.find((file: string) => {
          const filename = file.split('/').pop();
          return filename?.startsWith(`${conversationId}-`) && filename.endsWith('.json');
        });
        
        if (!oldFormatFile) {
          return null;
        }
        
        // Parse old format filename to extract metadata (without loading the full file)
        const filename = oldFormatFile.split('/').pop()!;
        const nameWithoutExt = filename.slice(0, -5); // Remove .json
        const dashIndex = nameWithoutExt.indexOf('-');
        const remainingPart = nameWithoutExt.substring(dashIndex + 1);
        
        // Check if it ends with -U (unread flag)
        let escapedTitle: string;
        let isUnread = false;
        
        if (remainingPart.endsWith('-U')) {
          escapedTitle = remainingPart.slice(0, -2); // Remove -U
          isUnread = true;
        } else {
          escapedTitle = remainingPart;
          isUnread = false;
        }
        
        // Unescape title
        const title = escapedTitle
          .replace(/_/g, ' ')
          .replace(/·/g, '.'); // Convert middle dots back to regular dots

        const stat = await app.vault.adapter.stat(newFormatPath);

        return {
          id: conversationId,
          filePath: newFormatPath,
          updatedAt: stat?.mtime || 0,
        };
      } catch (error) {
        console.error(`Failed to load conversation metadata ${conversationId}:`, error);
        return null;
      }
    },

    // Global conversation list management
    refreshConversationList: async () => {
      try {
        const basicInfos = await get().listConversations();
        const items: ConversationListItem[] = basicInfos.map(info => ({
          ...info,
          isMetadataLoaded: false,
          isFullyLoaded: false
        }));
        
        set((state) => {
          state.conversationList.items = items;
          state.conversationList.isLoaded = true;
          state.conversationList.lastRefreshTime = Date.now();
        });
      } catch (error) {
        console.error('Failed to refresh conversation list:', error);
      }
    },

    updateConversationInList: (conversationId: string, updates: Partial<ConversationListItem>) => {
      set((state) => {
        const index = state.conversationList.items.findIndex(item => item.id === conversationId);
        if (index !== -1) {
          // Update existing conversation
          Object.assign(state.conversationList.items[index], updates);
        } else {
          // Add new conversation if it doesn't exist
          const newItem: ConversationListItem = {
            id: conversationId,
            updatedAt: updates.updatedAt || Date.now(),
            filePath: updates.filePath || '',
            title: updates.title,
            isUnread: updates.isUnread,
            isMetadataLoaded: updates.title !== undefined && updates.isUnread !== undefined,
            isFullyLoaded: false,
            ...updates
          };
          state.conversationList.items.unshift(newItem); // Add to beginning since it's newest
        }
        
        // If updatedAt was changed, re-sort the list
        if (updates.updatedAt) {
          state.conversationList.items.sort((a, b) => b.updatedAt - a.updatedAt);
        }
      });
    },

    markConversationMetadataLoaded: (conversationId: string, metadata: ConversationMeta) => {
      set((state) => {
        const index = state.conversationList.items.findIndex(item => item.id === conversationId);
        if (index !== -1) {
          state.conversationList.items[index].isMetadataLoaded = true;
        }
      });
    },

    markConversationFullyLoaded: (conversationId: string) => {
      set((state) => {
        const index = state.conversationList.items.findIndex(item => item.id === conversationId);
        if (index !== -1) {
          state.conversationList.items[index].isFullyLoaded = true;
        }
      });
    },

    removeConversationFromList: (conversationId: string) => {
      set((state) => {
        state.conversationList.items = state.conversationList.items.filter(item => item.id !== conversationId);
      });
    },
  };
}; 