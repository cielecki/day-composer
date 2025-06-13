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

export interface ConversationListItem {
	id: string;
	updatedAt: number;
	filePath: string;
	// Lazy-loaded metadata:
	title?: string;
	isUnread?: boolean;
	isMetadataLoaded: boolean;
	isFullyLoaded: boolean; // Full chat loaded in memory
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
	storedConversation: StoredConversation;
}

// Input state for the unified input area
export interface InputState {
	text: string;
	attachedImages: AttachedImage[];
}

// Extended chat with runtime state (previously global state, now per-chat)
export interface ChatWithState {
	chat: Chat;
	// Runtime generation state
	isGenerating: boolean;
	editingMessage: { index: number; content: string; images?: AttachedImage[] } | null;
	liveToolResults: Map<string, ToolResultBlock>;
	abortController: AbortController | null;
	saveTimeout: NodeJS.Timeout | null;
	// UI state that should persist with the chat
	activeModeId: string; // Current mode for this chat
	inputState: InputState; // Current input text and attachments
	hasBackingFile: boolean; // Whether this chat has been saved to a file
}
