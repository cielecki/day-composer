import { Anthropic } from "@anthropic-ai/sdk";
import { Message } from "./types";
import { ensureContentBlocks, formatContentBlocks } from "./content-blocks";
import { validateAndCleanMessages } from "./message-validation";

/**
 * Formats messages for the Anthropic API, ensuring content is compatible
 */
export const formatMessagesForAPI = (messages: Message[]): Anthropic.Messages.MessageParam[] => {
	// First, validate and clean the messages to handle incomplete tool calls
	const cleanedMessages = validateAndCleanMessages(messages);
	
	const formattedMessages: Anthropic.Messages.MessageParam[] = [];
	
	for (const msg of cleanedMessages) {
		let apiContent: Anthropic.Messages.MessageParam["content"];
		const contentBlocks = ensureContentBlocks(msg.content); // Ensure array of blocks
		const formattedBlocks = formatContentBlocks(contentBlocks);

		// Handle case where content was empty/invalid after filtering
		if (!formattedBlocks || formattedBlocks.length === 0) {
			// Skip messages with no valid content blocks instead of sending empty text
			// This prevents the "text content blocks must be non-empty" error
			console.warn(`Skipping message with empty content blocks for role: ${msg.role}`);
			continue;
		}

		apiContent = formattedBlocks;

		formattedMessages.push({
			role: msg.role,
			content: apiContent,
		});
	}
	
	return formattedMessages;
}; 