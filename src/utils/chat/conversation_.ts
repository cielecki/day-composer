import { Message } from './types';

// Database schema version for migrations
export const CURRENT_SCHEMA_VERSION = 1;

export interface ConversationMeta {
	id: string;
	title: string;
	filePath: string;
	updatedAt: number;
}

export interface StoredConversation {
	version: number;
	modeId: string;
	titleGenerated: boolean;
	messages: Message[];
}

export interface Conversation {
	meta: ConversationMeta;
	storedConversation: StoredConversation;
}
