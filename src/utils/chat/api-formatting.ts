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
	
	return cleanedMessages.map((msg) => {
		let apiContent: Anthropic.Messages.MessageParam["content"];
		const contentBlocks = ensureContentBlocks(msg.content); // Ensure array of blocks

		apiContent = formatContentBlocks(contentBlocks);

		// Handle case where content was empty/invalid
		if (!apiContent || apiContent.length === 0) {
			apiContent = [{ type: "text", text: "" }]; // Send empty text block if needed
		}

		return {
			role: msg.role,
			content: apiContent,
		};
	});
}; 