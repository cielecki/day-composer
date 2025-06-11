import { Message } from '../../types/message';
import { ChatCostData } from '../../types/cost-tracking';

// Database schema version for migrations
export const CURRENT_SCHEMA_VERSION = 2;

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
	costData?: ChatCostData; // Optional for backward compatibility
}

export interface Chat {
	meta: ConversationMeta;
	storedConversation: StoredConversation;
}
