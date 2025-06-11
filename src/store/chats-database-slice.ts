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

// Database slice interface
export interface ChatsDatabaseSlice {
  // State
  database: {
    isInitialized: boolean;
  };
  
  // Database Actions (migrated from ConversationDatabase)
  initializeDatabase: () => Promise<void>;
  saveConversation: () => Promise<string | null>;
  loadConversation: (conversationId: string) => Promise<boolean>;
  loadConversationData: (conversationId: string) => Promise<StoredConversation | null>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  autoSaveConversation: () => Promise<void>;
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

    saveConversation: async () => {
      try {
        const app = getApp();
        const conversationsDir = getConversationsDir();

        // Prepare the conversation within the store action
        set((state) => {
          // Set the mode ID
          state.chats.current.storedConversation.modeId = state.modes.activeId;
        });

        // Handle title generation if needed (async operation)
        if (!get().chats.current.storedConversation.titleGenerated && 
          get().chats.current.storedConversation.messages.length >= 2) {
            console.debug("Generating title", get().chats.current.storedConversation.messages.length);
        
            const generatedTitle = await generateChatTitle(
              get().chats.current.storedConversation.messages
            );
            
            set((state) => {
              state.chats.current.meta.title = generatedTitle;
              state.chats.current.storedConversation.titleGenerated = true;
            });
          }

        // Get the prepared conversation and save it
        const finalState = get();
        const conversation = finalState.chats.current;

        // Check for existing conversation and clean up old files
        let existingConversation: StoredConversation | null = null;
        try {
          existingConversation = await finalState.loadConversationData(conversation.meta.id);
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

    autoSaveConversation: async () => {
      // Only auto-save if there are messages and not currently generating
      if (get().chats.current.storedConversation.messages.length === 0 || get().chats.isGenerating) {
        return;
      }
      
      try {
        const conversationId = await get().saveConversation();
        if (conversationId) {
          console.debug(`Auto-saved conversation: ${conversationId}`);
        }
      } catch (error) {
        console.error('Failed to auto-save conversation:', error);
      }
    },

    loadConversation: async (conversationId) => {
      try {
        // Load the stored conversation data
        const storedConversation = await get().loadConversationData(conversationId);
        
        if (!storedConversation) {
          new Notice(t('ui.chat.conversationNotFound'));
          return false;
        }

        // Get metadata for the conversation
        const meta = await get().getConversationMeta(conversationId);
        
        if (!meta) {
          new Notice(t('ui.chat.conversationMetadataNotFound'));
          return false;
        }

        // Reconstruct the full conversation object and load it
        const chat: Chat = {
          meta: meta,
          storedConversation: storedConversation
        };

        // Load the conversation into the current state using existing action
        get().setCurrentChat(chat);
        
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
        
        // If we just deleted the current conversation, clear the chat
        const currentState = get();
        if (currentState.chats.current.meta.id === conversationId) {
          currentState.clearChat();
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
        
        // If this is the current conversation, update the local state too
        const currentState = get();
        if (currentState.chats.current.meta.id === conversationId) {
          set((state) => {
            state.chats.current.meta.title = title;
          });
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