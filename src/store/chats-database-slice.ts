import type { ImmerStateCreator } from './plugin-store';
import { Chat, ConversationMeta, StoredConversation } from 'src/utils/chat/conversation';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { generateChatTitle } from 'src/utils/chat/generate-conversation-title';
import { Notice } from 'obsidian';
import { t } from 'src/i18n';
import { normalizePath } from 'obsidian';
import { ensureDirectoryExists } from 'src/utils/fs/ensure-directory-exists';
import { escapeFilename } from 'src/utils/fs/escape-filename';
import { chatFileNameToIdAndTitle } from 'src/utils/chat/chat-file-name-to-id-and-title';
import { DEFAULT_MODE_ID } from '../utils/modes/ln-mode-defaults';

// Database slice interface
export interface ChatsDatabaseSlice {
  // State
  database: {
    isInitialized: boolean;
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
  
  // Helper methods
  getConversationDatabase: () => null; // Deprecated - functionality moved to this slice
}

// Create database slice - migrating all ConversationDatabase functionality
export const createChatsDatabaseSlice: ImmerStateCreator<ChatsDatabaseSlice> = (set, get) => {
  
  // Helper functions (migrated from ConversationDatabase)
  const getApp = () => {
    const plugin = LifeNavigatorPlugin.getInstance();
    if (!plugin?.app) {
      throw new Error('LifeNavigator plugin not initialized');
    }
    return plugin.app;
  };

  const getConversationsDir = () => {
    const plugin = LifeNavigatorPlugin.getInstance();
    if (!plugin) {
      throw new Error('LifeNavigator plugin not initialized');
    }
    return normalizePath(`${plugin.manifest.dir}/conversations`);
  };

  const getConversationFiles = async (): Promise<string[]> => {
    try {
      const app = getApp();
      const conversationsDir = getConversationsDir();
      const files = await app.vault.adapter.list(conversationsDir);
      // Extract just the filename from the full path
      const jsonFiles = files.files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          // Extract filename from full path
          const parts = file.split('/');
          return parts[parts.length - 1];
        });
      return jsonFiles;
    } catch (error) {
      console.error('Failed to list conversation files:', error);
      return [];
    }
  };

  return {
    database: {
      isInitialized: false,
    },

    getConversationDatabase: () => {
      // Deprecated - functionality moved to this slice
      return null;
    },

    initializeDatabase: async () => {
      try {
        const conversationsDir = getConversationsDir();
        const app = getApp();
        await ensureDirectoryExists(conversationsDir, app);
        
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

        // If no chatId provided, we need to determine which chat to save
        // For backward compatibility, we could save all loaded chats, but that's expensive
        // For now, require explicit chatId
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
                chatState.chat.meta.title = generatedTitle;
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
          // Conversation doesn't exist yet, which is fine
        }

        // Generate filename and save
        const escapedTitle = escapeFilename(conversation.meta.title);
        const truncatedTitle = escapedTitle.substring(0, 100);
        const fileName = `${conversationsDir}/${conversation.meta.id}-${truncatedTitle}.json`;

        // If there's an existing conversation, clean up its files
        if (existingConversation) {
          const files = await getConversationFiles();
          const oldFiles = files.filter(filename => {
            const parsed = chatFileNameToIdAndTitle(filename);
            return parsed?.id === conversation.meta.id;
          });

          // Remove all old files for this conversation
          for (const oldFile of oldFiles) {
            const oldFilepath = `${conversationsDir}/${oldFile}`;
            if (oldFilepath !== fileName) { // Don't delete the new file
              try {
                await app.vault.adapter.remove(oldFilepath);
                console.debug(`Removed old conversation file: ${oldFile}`);
              } catch (error) {
                console.warn(`Failed to remove old conversation file ${oldFile}:`, error);
              }
            }
          }
        }

        // Save the conversation
        const conversationData = JSON.stringify(conversation.storedConversation, null, 2);
        console.debug(`Attempting to save conversation to: ${fileName}`);
        await app.vault.adapter.write(fileName, conversationData);
        console.debug(`Successfully saved conversation: ${fileName}`);

        set((state) => {
          const chatState = state.chats.loaded.get(chatId);
          if (chatState) {
            chatState.chat.meta.filePath = fileName;
          }
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
        const files = await getConversationFiles();
        const targetFile = files.find(filename => {
          const parsed = chatFileNameToIdAndTitle(filename);
          return parsed?.id === conversationId;
        });

        if (!targetFile) {
          return null;
        }

        const filepath = `${conversationsDir}/${targetFile}`;
        const conversationData = await app.vault.adapter.read(filepath);
        const storedConversation: StoredConversation = JSON.parse(conversationData);
        
        return storedConversation;
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

        // Get metadata for the conversation
        const meta = await get().getConversationMeta(conversationId);
        
        if (!meta) {
          console.warn(`Conversation ${conversationId} metadata not found`);
          return false;
        }

        // Reconstruct the full conversation object and load it
        const chat: Chat = {
          meta: meta,
          storedConversation: storedConversation
        };

        // Load the conversation into a new chat using the conversation ID as chat ID
        get().setCurrentChat(conversationId, chat);
        
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
        const files = await getConversationFiles();
        const targetFile = files.find(filename => {
          const parsed = chatFileNameToIdAndTitle(filename);
          return parsed?.id === conversationId;
        });

        if (!targetFile) {
          new Notice(t('ui.chat.conversationDeleteFailed'));
          return false;
        }

        const filepath = `${conversationsDir}/${targetFile}`;
        await app.vault.adapter.remove(filepath);
        
        // If we have any loaded chats with this conversation ID, unload them
        const loadedChats = get().chats.loaded;
        for (const [chatId, chatState] of loadedChats) {
          if (chatState.chat.meta.id === conversationId) {
            await get().unloadChat(chatId);
          }
        }
        
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

        // Process each file to get filesystem-level metadata
        for (const filename of files) {
          try {
            const filepath = `${conversationsDir}/${filename}`;
            
            // Get data from filename parsing
            const filenameData = chatFileNameToIdAndTitle(filename);
            if (!filenameData) {
              console.warn(`Could not parse filename: ${filename}`);
              continue;
            }

            // Get filesystem metadata
            const stat = await app.vault.adapter.stat(filepath);
            
            // Create conversation metadata
            const meta: ConversationMeta = {
              id: filenameData.id,
              title: filenameData.title,
              filePath: filepath,
              updatedAt: stat?.mtime || 0
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
        const files = await getConversationFiles();
        const targetFile = files.find(filename => {
          const parsed = chatFileNameToIdAndTitle(filename);
          return parsed?.id === conversationId;
        });

        if (!targetFile) {
          return null;
        }

        const filepath = `${conversationsDir}/${targetFile}`;
        
        // Get data from filename parsing
        const filenameData = chatFileNameToIdAndTitle(targetFile);
        if (!filenameData) {
          return null;
        }

        // Get filesystem metadata
        const stat = await app.vault.adapter.stat(filepath);
        
        // For detailed metadata, we need to read the file content
        const conversationData = await app.vault.adapter.read(filepath);
        const storedConversation: StoredConversation = JSON.parse(conversationData);

        const meta: ConversationMeta = {
          id: filenameData.id,
          title: filenameData.title,
          filePath: filepath,
          updatedAt: stat?.mtime || 0
        };

        return meta;
      } catch (error) {
        console.error(`Failed to get conversation metadata ${conversationId}:`, error);
        return null;
      }
    },

    searchConversations: async (query) => {
      try {
        const conversations = await get().listConversations();
        const lowercaseQuery = query.toLowerCase();
        
        return conversations.filter(conv => 
          conv.title.toLowerCase().includes(lowercaseQuery)
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
        const files = await getConversationFiles();
        const targetFile = files.find(filename => {
          const parsed = chatFileNameToIdAndTitle(filename);
          return parsed?.id === conversationId;
        });

        if (!targetFile) {
          new Notice(t('ui.chat.conversationTitleUpdateFailed'));
          return false;
        }

        const oldFilepath = `${conversationsDir}/${targetFile}`;
        
        // Read the conversation data
        const conversationData = await app.vault.adapter.read(oldFilepath);
        
        // Create new filename with updated title
        const escapedTitle = escapeFilename(title);
        const truncatedTitle = escapedTitle.substring(0, 100);
        const newFilepath = `${conversationsDir}/${conversationId}-${truncatedTitle}.json`;
        
        // Write to new location and remove old file
        await app.vault.adapter.write(newFilepath, conversationData);
        if (oldFilepath !== newFilepath) {
          await app.vault.adapter.remove(oldFilepath);
        }
        
        // If this conversation is loaded in any chat, update the local state too
        const loadedChats = get().chats.loaded;
        for (const [chatId, chatState] of loadedChats) {
          if (chatState.chat.meta.id === conversationId) {
            set((state) => {
              const chatState = state.chats.loaded.get(chatId);
              if (chatState) {
                chatState.chat.meta.title = title;
              }
            });
          }
        }
        
        new Notice(t('ui.chat.conversationTitleUpdated'));
        return true;
      } catch (error) {
        console.error('Failed to update conversation title:', error);
        new Notice(t('ui.chat.conversationTitleUpdateFailed'));
        return false;
      }
    },
  };
}; 