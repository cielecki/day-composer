import { Message, ToolResultBlock } from '../../types/message';
import { ChatCostData } from '../../types/cost-tracking';
import { AttachedImage } from '../../types/attached-image';

// Database schema version for migrations
export const CURRENT_SCHEMA_VERSION = 3; // Increment for new storage format

export interface ConversationMeta {
	id: string;
	filePath: string;
	updatedAt: number;
}

export interface StoredConversation {
	version: number;
	title: string;
	isUnread: boolean;
	modeId: string;
	titleGenerated: boolean;
	messages: Message[];
	costData?: ChatCostData; // Optional for backward compatibility
}

export interface Chat {
	meta: ConversationMeta;
	storedConversation?: StoredConversation; // Now optional to support lazy loading
}

// For loaded chats where storedConversation is guaranteed to exist
export interface LoadedChat {
	meta: ConversationMeta;
	storedConversation: StoredConversation; // Required for loaded chats
}

// Input state for the unified input area
export interface InputState {
	text: string;
	attachedImages: AttachedImage[];
}

// Extended chat with runtime state (previously global state, now per-chat)
export interface ChatWithState {
	chat: LoadedChat; // Use LoadedChat to ensure storedConversation exists
	// Runtime generation state
	isGenerating: boolean;
	editingMessage: { index: number; content: string; images?: AttachedImage[]; modeId?: string } | null;
	liveToolResults: Map<string, ToolResultBlock>;
	abortController: AbortController | null;
	saveTimeout: NodeJS.Timeout | null;
	// Audio transcription state (chat-specific)
	isTranscribing: boolean;
	transcriptionId?: string; // to track multiple transcriptions
	lastTranscription: string | null;
	// UI state that should persist with the chat
	inputState: InputState; // Current input text and attachments
	hasBackingFile: boolean; // Whether this chat has been saved to a file
}

// Helper functions for creating Chat objects in different loading states
export function createPartialChat(meta: ConversationMeta): Chat {
	return {
		meta,
		// storedConversation is undefined = not loaded yet
	};
}

export function createMetadataLoadedChat(meta: ConversationMeta, title: string, isUnread: boolean, modeId: string = ''): Chat {
	return {
		meta,
		storedConversation: {
			version: CURRENT_SCHEMA_VERSION,
			title,
			isUnread,
			modeId,
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
}

export function createFullyLoadedChat(meta: ConversationMeta, storedConversation: StoredConversation): Chat {
	return {
		meta,
		storedConversation
	};
}

// Helper functions to check chat loading state
export function isMetadataLoaded(chat: Chat): boolean {
	return chat.storedConversation !== undefined;
}

export function isFullyLoaded(chat: Chat): boolean {
	return chat.storedConversation !== undefined && chat.storedConversation.messages.length > 0;
}
