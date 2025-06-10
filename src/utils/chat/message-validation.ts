import { Message, ContentBlock, ThinkingBlock } from "../../types/message";
import { ensureContentBlocks, filterEmptyContentBlocks } from "./content-blocks";

/**
 * Validates and cleans messages to prevent incomplete tool call issues
 */
export const validateAndCleanMessages = (messages: Message[]): Message[] => {
	const cleanedMessages: Message[] = [];
	
	for (let i = 0; i < messages.length; i++) {
		const currentMessage = messages[i];
		
		// If this is an assistant message, check for tool_use blocks AND incomplete thinking blocks
		if (currentMessage.role === "assistant") {
			const contentBlocks = ensureContentBlocks(currentMessage.content);
			
			// Filter out empty content blocks first
			const filteredBlocks = filterEmptyContentBlocks(contentBlocks);
			
			// If after filtering there are no valid content blocks, skip this message but continue processing
			if (filteredBlocks.length === 0) {
				console.warn("Skipping assistant message with no valid content blocks");
				continue; // Skip this message but continue processing others
			}
			
			const toolUseBlocks = filteredBlocks.filter(block => block.type === "tool_use");
			
			// Check for incomplete thinking blocks that shouldn't be sent to API
			// Incomplete thinking blocks are those without a signature or still in progress
			const incompleteThinkingBlocks = filteredBlocks.filter(block => 
				block.type === "thinking" && 
				(!(block as ThinkingBlock).signature || (block as ThinkingBlock).reasoningInProgress)
			);
			
			if (incompleteThinkingBlocks.length > 0) {
				console.warn("Skipping assistant message with incomplete thinking blocks");
				continue; // Skip this message but continue processing others
			}
			
			if (toolUseBlocks.length > 0) {
				// This assistant message contains tool calls
				// Check if the next message contains corresponding tool_result blocks
				const nextMessage = messages[i + 1];
				
				if (!nextMessage || nextMessage.role !== "user") {
					// No next message or next message is not a user message
					// This means we have incomplete tool calls - exclude this message
					break; // Stop processing here to avoid incomplete conversation
				}
				
				// Check if all tool_use blocks have corresponding tool_result blocks
				const nextContentBlocks = filterEmptyContentBlocks(ensureContentBlocks(nextMessage.content));
				const toolResultBlocks = nextContentBlocks.filter(block => block.type === "tool_result");
				
				const toolUseIds = new Set(toolUseBlocks.map(block => block.id));
				const toolResultIds = new Set(toolResultBlocks.map(block => block.tool_use_id));
				
				// Check if all tool_use IDs have corresponding tool_result IDs
				const missingResults = [...toolUseIds].filter(id => !toolResultIds.has(id));
				
				if (missingResults.length > 0) {
					break; // Stop processing here to avoid incomplete conversation
				}
			}
			
			// Update the message with filtered content blocks
			const cleanedMessage = { ...currentMessage, content: filteredBlocks };
			cleanedMessages.push(cleanedMessage);
		} else {
			// For user messages, also filter empty content blocks
			const contentBlocks = ensureContentBlocks(currentMessage.content);
			const filteredBlocks = filterEmptyContentBlocks(contentBlocks);
			
			// If after filtering there are no valid content blocks, skip this message but continue processing
			if (filteredBlocks.length === 0) {
				console.warn("Skipping user message with no valid content blocks");
				continue; // Skip this message but continue processing others
			}
			
			const cleanedMessage = { ...currentMessage, content: filteredBlocks };
			cleanedMessages.push(cleanedMessage);
		}
	}
	
	return cleanedMessages;
};

/**
 * Checks if a conversation needs cleanup due to incomplete tool calls or thinking
 */
export const needsCleanup = (messages: Message[]): boolean => {
	if (messages.length === 0) return false;
	
	const lastMessage = messages[messages.length - 1];
	
	if (lastMessage.role === "assistant") {
		const contentBlocks = ensureContentBlocks(lastMessage.content);
		const filteredBlocks = filterEmptyContentBlocks(contentBlocks);
		
		// If no valid content blocks remain after filtering, needs cleanup
		if (filteredBlocks.length === 0) return true;
		
		const toolUseBlocks = filteredBlocks.filter(block => block.type === "tool_use");
		const incompleteThinkingBlocks = filteredBlocks.filter(block => 
			block.type === "thinking" && (block as ThinkingBlock).reasoningInProgress
		);
		
		return toolUseBlocks.length > 0 || incompleteThinkingBlocks.length > 0;
	}
	
	return false;
};

/**
 * Removes the last message if it contains incomplete tool calls or thinking
 */
export const cleanupLastMessage = (messages: Message[]): Message[] => {
	if (needsCleanup(messages)) {
		return messages.slice(0, -1);
	}
	return messages;
}; 