// Conversation Database Service - Individual File Storage
// Each conversation stored as separate JSON file with metadata in filename

import { normalizePath } from 'obsidian';
import { generateConversationTitle } from '../utils/chat/generate-conversation-title';
import { ensureDirectoryExists } from '../utils/fs/ensure-directory-exists';
import { escapeFilename } from '../utils/fs/escape-filename';
import { Chat, StoredConversation, CURRENT_SCHEMA_VERSION, ConversationMeta } from '../utils/chat/conversation';
import { chatFileNameToIdAndTitle } from '../utils/chat/chat-file-name-to-id-and-title';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';

export class ConversationDatabase {
	private get app() {
		const plugin = LifeNavigatorPlugin.getInstance();
		if (!plugin?.app) {
			throw new Error('LifeNavigator plugin not initialized');
		}
		return plugin.app;
	}

	private get conversationsDir() {
		const plugin = LifeNavigatorPlugin.getInstance();
		if (!plugin) {
			throw new Error('LifeNavigator plugin not initialized');
		}
		return normalizePath(`${plugin.manifest.dir}/conversations`);
	}

	/**
	 * Initialize the database, creating directories and migrating if needed
	 */
	async initialize(): Promise<void> {
		await ensureDirectoryExists(this.conversationsDir, this.app);
	}

	/**
	 * Get all conversation files
	 */
	private async getConversationFiles(): Promise<string[]> {
		try {
			const files = await this.app.vault.adapter.list(this.conversationsDir);
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
			// Return empty array if directory can't be read
			return [];
		}
	}

	/**
	 * Save a conversation to individual file
	 */
	async saveConversation(
		conversation: Chat
	): Promise<string> {
		if (!conversation.meta.title) {
			conversation.meta.title = "New Chat";
		}

		if (!conversation.storedConversation.titleGenerated && conversation.storedConversation.messages.length >= 2) {
			conversation.meta.title = await generateConversationTitle(conversation.storedConversation.messages);
			conversation.storedConversation.titleGenerated = true;
		}

		let existingConversation: StoredConversation | null = null;
		try {
			existingConversation = await this.loadConversation(conversation.meta.id);
		} catch (error) {
			// Conversation doesn't exist yet, which is fine
		}

		// Generate filename and save
		const escapedTitle = escapeFilename(conversation.meta.title);
		const truncatedTitle = escapedTitle.substring(0, 100);
		const fileName = `${this.conversationsDir}/${conversation.meta.id}-${truncatedTitle}.json`;

		// If there's an existing conversation, clean up its files
		if (existingConversation) {
			const files = await this.getConversationFiles();
			const oldFiles = files.filter(filename => {
				const parsed = chatFileNameToIdAndTitle(filename);
				return parsed?.id === conversation.meta.id;
			});

			// Remove all old files for this conversation
			for (const oldFile of oldFiles) {
				const oldFilepath = `${this.conversationsDir}/${oldFile}`;
				if (oldFilepath !== fileName) { // Don't delete the new file
					try {
						await this.app.vault.adapter.remove(oldFilepath);
						console.log(`Removed old conversation file: ${oldFile}`);
					} catch (error) {
						console.warn(`Failed to remove old conversation file ${oldFile}:`, error);
					}
				}
			}
		}

		try {
			const conversationData = JSON.stringify(conversation.storedConversation, null, 2);
			console.log(`Attempting to save conversation to: ${fileName}`);
			await this.app.vault.adapter.write(fileName, conversationData);
			console.log(`Successfully saved conversation: ${fileName} (version ${CURRENT_SCHEMA_VERSION})`);
			return conversation.meta.id;
		} catch (error) {
			throw new Error(`Failed to save conversation: ${error.message}`);
		}
	}

	/**
	 * Load a conversation by ID
	 */
	async loadConversation(conversationId: string): Promise<StoredConversation | null> {
		try {
			const files = await this.getConversationFiles();
			const targetFile = files.find(filename => {
				const parsed = chatFileNameToIdAndTitle(filename);
				return parsed?.id === conversationId;
			});

			if (!targetFile) {
				return null;
			}

			const filepath = `${this.conversationsDir}/${targetFile}`;
			const conversationData = await this.app.vault.adapter.read(filepath);
			const storedConversation: StoredConversation = JSON.parse(conversationData);
			
			return storedConversation;
		} catch (error) {
			console.error(`Failed to load conversation ${conversationId}:`, error);
			return null;
		}
	}

	/**
	 * Delete a conversation
	 */
	async deleteConversation(conversationId: string): Promise<boolean> {
		try {
			const files = await this.getConversationFiles();
			const targetFile = files.find(filename => {
				const parsed = chatFileNameToIdAndTitle(filename);
				return parsed?.id === conversationId;
			});

			if (!targetFile) {
				return false;
			}

			const filepath = `${this.conversationsDir}/${targetFile}`;
			await this.app.vault.adapter.remove(filepath);
			return true;
		} catch (error) {
			console.error(`Failed to delete conversation ${conversationId}:`, error);
			return false;
		}
	}

	/**
	 * List all conversations sorted by recency (file modification time)
	 * This method efficiently gets metadata without reading file content unless needed
	 */
	async listConversations(): Promise<ConversationMeta[]> {
		try {
			const files = await this.getConversationFiles();
			const conversations: ConversationMeta[] = [];

			// Process each file to get filesystem-level metadata
			for (const filename of files) {
				try {
					const filepath = `${this.conversationsDir}/${filename}`;
					
					// Get data from filename parsing
					const filenameData = chatFileNameToIdAndTitle(filename);
					if (!filenameData) {
						console.warn(`Could not parse filename: ${filename}`);
						continue;
					}

					// Get filesystem metadata
					const stat = await this.app.vault.adapter.stat(filepath);
					
					// Combine into filesystem data
					const filesystemData: ConversationMeta = {
						id: filenameData.id,
						title: filenameData.title,
						filePath: filepath,
						updatedAt: stat?.mtime || 0
					};

					// For basic listing, we don't need to read file content
					// modeId will be undefined, but that's fine for listing
					const meta: ConversationMeta = {
						...filesystemData,
						// modeId is undefined - only loaded when specifically needed
					};

					conversations.push(meta);
				} catch (error) {
					console.error(`Failed to process conversation file ${filename}:`, error);
				}
			}

			// Sort by file modification time (most recent first)
			conversations.sort((a, b) => b.updatedAt - a.updatedAt);

			return conversations;
		} catch (error) {
			console.error('Failed to list conversations:', error);
			return [];
		}
	}

	async getConversationMeta(conversationId: string): Promise<ConversationMeta | null> {
		try {
			const files = await this.getConversationFiles();
			const targetFile = files.find(filename => {
				const parsed = chatFileNameToIdAndTitle(filename);
				return parsed?.id === conversationId;
			});

			if (!targetFile) {
				return null;
			}

			const filepath = `${this.conversationsDir}/${targetFile}`;
			
			// Get data from filename parsing
			const filenameData = chatFileNameToIdAndTitle(targetFile);
			if (!filenameData) {
				return null;
			}

			// Get filesystem metadata
			const stat = await this.app.vault.adapter.stat(filepath);
			
			// Combine into filesystem data
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
	}

	/**
	 * Search conversations by title, content, or mode
	 * Note: For mode search, this needs to read file content
	 */
	async searchConversations(query: string): Promise<ConversationMeta[]> {
		const lowerQuery = query.toLowerCase();
		
		// Get basic conversations first
		const basicConversations = await this.listConversations();
		
		// Filter by title first (no file reading needed)
		const titleMatches = basicConversations.filter(meta => 
			meta.title.toLowerCase().includes(lowerQuery)
		);

		// For mode searches, we need to read file content
		const modeMatches: ConversationMeta[] = [];
		for (const conversation of basicConversations) {
			try {
				const storedConversation = await this.loadConversation(conversation.id);
				if (storedConversation?.modeId?.toLowerCase().includes(lowerQuery)) {
					modeMatches.push(conversation);
				}
			} catch (error) {
				console.error(`Failed to check mode for conversation ${conversation.id}:`, error);
			}
		}

		// Combine and deduplicate results
		const allMatches = new Map<string, ConversationMeta>();
		
		// Add title matches
		titleMatches.forEach(meta => allMatches.set(meta.id, meta));
		
		// Add mode matches
		modeMatches.forEach(meta => allMatches.set(meta.id, meta));

		return Array.from(allMatches.values())
			.sort((a, b) => b.updatedAt - a.updatedAt);
	}

	/**
	 * Update conversation title
	 */
	async updateConversationTitle(
		conversationId: string, 
		title: string
	): Promise<boolean> {
		try {
			// Load the existing conversation
			const storedConversation = await this.loadConversation(conversationId);
			if (!storedConversation) {
				return false;
			}

			// Create updated conversation object
			const conversation: Chat = {
				meta: {
					id: conversationId,
					title,
					filePath: '', // Will be set by saveConversation
					updatedAt: Date.now()
				},
				storedConversation
			};

			// Save with new title (this will handle file cleanup)
			await this.saveConversation(conversation);
			return true;
		} catch (error) {
			console.error(`Failed to update conversation title ${conversationId}:`, error);
			return false;
		}
	}
} 