import type { ImmerStateCreator } from './plugin-store';
import { ConversationMeta, StoredConversation, Chat, createPartialChat, createMetadataLoadedChat, createFullyLoadedChat, isMetadataLoaded, isFullyLoaded, CURRENT_SCHEMA_VERSION } from '../utils/chat/conversation';
import { generateChatTitle } from '../utils/chat/generate-conversation-title';
import { Notice } from 'obsidian';
import { t } from '../i18n';
import { DEFAULT_MODE_ID } from '../utils/modes/ln-mode-defaults';

export interface ChatsDatabaseSlice {
  // State
  database: {
    isInitialized: boolean;
  };
  
  // Global conversation map for efficient lookups (replaces conversationList)
  conversations: Map<string, Chat>;
  conversationList: {
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
  
  // Global conversation list management (now using Map)
  refreshConversationList: () => Promise<void>;
  updateConversationInMap: (conversationId: string, updates: Partial<Chat>) => void;
  markConversationMetadataLoaded: (conversationId: string, metadata: ConversationMeta) => void;
  markConversationFullyLoaded: (conversationId: string) => void;
  removeConversationFromMap: (conversationId: string) => void;
  getConversationById: (conversationId: string) => Chat | undefined;
  getAllConversations: () => Chat[];
  
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
    
    conversations: new Map(),

    conversationList: {
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
        if (!chatState || !chatState.chat.storedConversation) {
          console.error(`[DATABASE] Chat ${chatId} not found or not fully loaded`);
          return null;
        }
        
        console.debug(`[DATABASE] Chat ${chatId} found, conversation ID: ${chatState.chat.meta.id}, messages: ${chatState.chat.storedConversation.messages.length}`);


        // Handle title generation if needed (async operation)
        if (!chatState.chat.storedConversation.titleGenerated && 
          chatState.chat.storedConversation.messages.length >= 2) {
            console.debug("Generating title", chatState.chat.storedConversation.messages.length);
        
            const generatedTitle = await generateChatTitle(
              chatState.chat.storedConversation.messages
            );
            
            set((state) => {
              const chatState = state.chats.loaded.get(chatId);
              if (chatState && chatState.chat.storedConversation) {
                chatState.chat.storedConversation.title = generatedTitle;
                chatState.chat.storedConversation.titleGenerated = true;
              }
            });
          }

        // Get the prepared conversation and save it
        const finalChatState = get().getChatState(chatId);
        if (!finalChatState || !finalChatState.chat.storedConversation) {
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
        if (!conversation.storedConversation) {
          console.error(`[DATABASE] Cannot save conversation ${chatId} - storedConversation is missing`);
          return null;
        }

        const storedConversation: StoredConversation = conversation.storedConversation;

        // Save the conversation
        const conversationData = JSON.stringify(storedConversation, null, 2);
        console.debug(`Attempting to save conversation to: ${fileName}`);
        await app.vault.adapter.write(fileName, conversationData);
        console.debug(`Successfully saved conversation: ${fileName}`);

        // Update meta info after saving
        set((state) => {
          const chatState = state.chats.loaded.get(chatId);
          if (chatState) {
            chatState.chat.meta.filePath = fileName;
            chatState.chat.meta.updatedAt = Date.now();
          }
        });

        console.debug(`[DATABASE] Conversation saved as ${fileName}, conversation ID: ${conversation.meta.id}`);
        
        // Update the conversation map with the new timestamp and title
        get().updateConversationInMap(conversation.meta.id, {
          meta: {
            ...conversation.meta,
            updatedAt: Date.now()
          },
          storedConversation: conversation.storedConversation
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
          if (!chatState.chat.storedConversation || chatState.chat.storedConversation.messages.length === 0 || chatState.isGenerating) {
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
      if (!chatState || !chatState.chat.storedConversation || chatState.chat.storedConversation.messages.length === 0 || chatState.isGenerating) {
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
        const filePath = `${conversationsDir}/${conversationId}.json`;
        const stat = await app.vault.adapter.stat(filePath);

        const meta: ConversationMeta = {
          id: conversationId,
          filePath,
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
        const filePath = `${conversationsDir}/${conversationId}.json`;
        
        await app.vault.adapter.remove(filePath);
        
        // If we have any loaded chats with this conversation ID, unload them
        const loadedChats = get().chats.loaded;
        for (const [chatId, chatState] of loadedChats) {
          if (chatState.chat.meta.id === conversationId) {
            await get().unloadChat(chatId);
          }
        }
        
        // Remove from conversation list
        get().removeConversationFromMap(conversationId);
        
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
            const filePath = `${conversationsDir}/${filename}`;
            
            // Get filesystem metadata
            const stat = await app.vault.adapter.stat(filePath);
            
            // Create conversation metadata
            const meta: ConversationMeta = {
              id: conversationId, // Fallback for old format
              filePath,
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
        const filePath = `${conversationsDir}/${conversationId}.json`;
        
        // Get filesystem metadata
        const stat = await app.vault.adapter.stat(filePath);
        
        const meta: ConversationMeta = {
          id: conversationId,
          filePath,
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
        const conversations = Array.from(get().conversations.values());
        const lowercaseQuery = query.toLowerCase();
        
        return conversations
          .filter(chat => 
            chat.storedConversation?.title?.toLowerCase().includes(lowercaseQuery)
          )
          .map(chat => chat.meta);
      } catch (error) {
        console.error('Failed to search conversations:', error);
        return [];
      }
    },

    updateConversationTitle: async (conversationId, title) => {
      try {
        const app = getApp();
        const conversationsDir = getConversationsDir();
        const filePath = `${conversationsDir}/${conversationId}.json`;
        
        // Read the conversation data
        const conversationData = await app.vault.adapter.read(filePath);
        const storedConversation: StoredConversation = JSON.parse(conversationData);
        
        // Update title in stored conversation
        storedConversation.title = title;
        
        // Write back to same file
        await app.vault.adapter.write(filePath, JSON.stringify(storedConversation, null, 2));
        
        // If this conversation is loaded in any chat, update the local state too
        const loadedChats = get().chats.loaded;
        for (const [chatId, chatState] of loadedChats) {
          if (chatState.chat.meta.id === conversationId) {
            set((state) => {
              const chatState = state.chats.loaded.get(chatId);
              if (chatState && chatState.chat.storedConversation) {
                chatState.chat.storedConversation.title = title;
                chatState.chat.meta.updatedAt = Date.now();
              }
            });
          }
        }

        // Update the conversation map
        const existingChat = get().conversations.get(conversationId);
        if (existingChat && existingChat.storedConversation) {
          get().updateConversationInMap(conversationId, {
            storedConversation: {
              ...existingChat.storedConversation,
              title: title
            },
            meta: {
              ...existingChat.meta,
              updatedAt: Date.now()
            }
          });
        }
        
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
            // If already loaded, update the conversation map with the loaded data
            const metadata = {
              id: chatState.chat.meta.id,
              filePath: chatState.chat.meta.filePath,
              updatedAt: chatState.chat.meta.updatedAt
            };
            
            // Update the conversation in the map with the full data
            get().updateConversationInMap(conversationId, {
              meta: metadata,
              storedConversation: chatState.chat.storedConversation
            });
            
            return metadata;
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
          
          const metadata = {
            id: conversationId,
            filePath: newFormatPath,
            updatedAt: stat?.mtime || 0,
          };
          
          // Update the conversation in the map with the loaded metadata
          get().updateConversationInMap(conversationId, {
            meta: metadata,
            storedConversation: {
              version: storedConversation.version,
              title: storedConversation.title || t('chat.titles.newChat'),
              isUnread: storedConversation.isUnread,
              modeId: storedConversation.modeId,
              titleGenerated: storedConversation.titleGenerated,
              messages: [], // Don't load full messages for metadata loading
              costData: storedConversation.costData || {
                total_cost: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_cache_write_tokens: 0,
                total_cache_read_tokens: 0,
                entries: [],
              }
            }
          });
          
          return metadata;
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

        const stat = await app.vault.adapter.stat(oldFormatFile);
        const metadata = {
          id: conversationId,
          filePath: oldFormatFile,
          updatedAt: stat?.mtime || 0,
        };
        
        // Update the conversation in the map with the extracted metadata
        get().updateConversationInMap(conversationId, {
          meta: metadata,
          storedConversation: {
            version: CURRENT_SCHEMA_VERSION,
            title: title,
            isUnread: isUnread,
            modeId: DEFAULT_MODE_ID,
            titleGenerated: false,
            messages: [], // Don't load full messages for metadata loading
            costData: {
              total_cost: 0,
              total_input_tokens: 0,
              total_output_tokens: 0,
              total_cache_write_tokens: 0,
              total_cache_read_tokens: 0,
              entries: [],
            }
          }
        });

        return metadata;
      } catch (error) {
        console.error(`Failed to load conversation metadata ${conversationId}:`, error);
        return null;
      }
    },

    // Global conversation list management
    refreshConversationList: async () => {
      try {
        const basicInfos = await get().listConversations();
        
        set((state) => {
          state.conversations.clear();
          
          // Create partial chats for each conversation
          basicInfos.forEach(info => {
            const partialChat = createPartialChat(info);
            state.conversations.set(info.id, partialChat);
          });

          state.conversationList.isLoaded = true;
          state.conversationList.lastRefreshTime = Date.now();
        });
      } catch (error) {
        console.error('Failed to refresh conversation list:', error);
      }
    },

    updateConversationInMap: (conversationId: string, updates: Partial<Chat>) => {
      set((state) => {
        const existingChat = state.conversations.get(conversationId);
        if (existingChat) {
          // Update existing conversation
          const updatedChat = {
            ...existingChat,
            ...updates,
            meta: {
              ...existingChat.meta,
              ...(updates.meta || {})
            }
          };
          state.conversations.set(conversationId, updatedChat);
        } else {
          // Create new conversation if it doesn't exist
          const newChat: Chat = {
            meta: {
              id: conversationId,
              filePath: updates.meta?.filePath || '',
              updatedAt: updates.meta?.updatedAt || Date.now()
            },
            storedConversation: updates.storedConversation
          };
          state.conversations.set(conversationId, newChat);
        }
      });
    },

    markConversationMetadataLoaded: (conversationId: string, metadata: ConversationMeta) => {
      set((state) => {
        const existingChat = state.conversations.get(conversationId);
        if (existingChat) {
          // Update the metadata
          existingChat.meta = metadata;
        }
      });
    },

    markConversationFullyLoaded: (conversationId: string) => {
      // This is now handled by updateConversationInMap when storedConversation is set
      // No separate action needed since we check for storedConversation existence
    },

    removeConversationFromMap: (conversationId: string) => {
      set((state) => {
        state.conversations.delete(conversationId);
      });
    },

    getConversationById: (conversationId: string) => {
      return get().conversations.get(conversationId);
    },

    getAllConversations: () => {
      return Array.from(get().conversations.values());
    },
  };
}; 