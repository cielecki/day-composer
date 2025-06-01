import { ConversationDatabase } from "../../services/conversation-database";
import { Conversation } from "./conversation";
import { Notice } from "obsidian";

export interface ConversationPersistenceContext {
	conversationDatabase: ConversationDatabase;
	getCurrentConversation: () => Conversation;
	activeModeIdRef: React.MutableRefObject<string>;
	lnModesRef: React.MutableRefObject<Record<string, any>>;
}

/**
 * Auto-saves a conversation with debouncing
 */
export const autoSaveConversation = async (
	context: ConversationPersistenceContext,
	isGeneratingResponse: boolean
): Promise<void> => {
	const conversation = context.getCurrentConversation();
	
	if (conversation.storedConversation.messages.length > 0 && !isGeneratingResponse) {
		try {
			const currentModeId = context.activeModeIdRef.current;
			conversation.storedConversation.modeId = currentModeId;
			
			const conversationId = await context.conversationDatabase.saveConversation(conversation);
			console.log(`Auto-saved conversation: ${conversationId}`);
		} catch (error) {
			console.error('Failed to auto-save conversation:', error);
		}
	}
};

/**
 * Immediately saves a conversation after first exchange
 */
export const saveConversationImmediately = async (
	context: ConversationPersistenceContext
): Promise<void> => {
	try {
		const conversation = context.getCurrentConversation();
		conversation.storedConversation.modeId = context.lnModesRef.current[context.activeModeIdRef.current].ln_path;
		
		// Save conversation with generated title
		await context.conversationDatabase.saveConversation(conversation);
		
		console.log(`Immediately saved conversation with title: ${conversation.meta.title}`);
	} catch (error) {
		console.error('Failed to immediately save conversation:', error);
	}
};

/**
 * Manually saves a conversation with optional title and tags
 */
export const saveCurrentConversation = async (
	context: ConversationPersistenceContext,
	title?: string,
	tags?: string[]
): Promise<string | null> => {
	try {
		const conversation = context.getCurrentConversation();
		const currentModeId = context.activeModeIdRef.current;
		conversation.storedConversation.modeId = currentModeId;
		
		// Save the conversation
		const conversationId = await context.conversationDatabase.saveConversation(conversation);
		
		new Notice('Conversation saved successfully');
		return conversationId;
	} catch (error) {
		console.error('Failed to save conversation:', error);
		new Notice('Failed to save conversation');
		return null;
	}
};

/**
 * Loads a conversation by ID
 */
export const loadConversation = async (
	context: ConversationPersistenceContext,
	conversationId: string,
	setConversation: (conversation: Conversation) => void
): Promise<boolean> => {
	try {
		// Load the stored conversation data
		const storedConversation = await context.conversationDatabase.loadConversation(conversationId);
		
		if (!storedConversation) {
			new Notice('Conversation not found');
			return false;
		}

		// Get metadata for the conversation
		const meta = await context.conversationDatabase.getConversationMeta(conversationId);
		
		if (!meta) {
			new Notice('Conversation metadata not found');
			return false;
		}

		// Reconstruct the full conversation object
		const conversation: Conversation = {
			meta: meta,
			storedConversation: storedConversation
		};

		// Load the conversation into the current state
		setConversation(conversation);
		return true;
	} catch (error) {
		console.error('Failed to load conversation:', error);
		new Notice('Failed to load conversation');
		return false;
	}
}; 