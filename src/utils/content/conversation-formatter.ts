import { t } from '../../i18n';
import { convertToValidTagName } from '../text/xml-tag-converter';

/**
 * Format the conversation into a readable string
 * @param conversation The conversation to format
 * @returns A formatted string representation of the conversation
 */
export function formatConversationContent(conversation: any[]): string {
	if (!conversation || conversation.length === 0) {
		return t('errors.chat.noContent');
	}

	// Get the translated tag names and convert them to valid XML tags
	const userTagName = convertToValidTagName(t('chat.userMessage'));
	const assistantTagName = convertToValidTagName(t('chat.assistantMessage'));
	
	// Build a formatted representation of the conversation with XML tags for each message
	const conversationContent = conversation
		.map((message) => {
			// Skip tool result messages
			if (message.role === "user" && Array.isArray(message.content)) {
				const isOnlyToolResults = message.content.every(
					(item: any) =>
						typeof item === "object" &&
						item !== null &&
						"type" in item &&
						item.type === "tool_result"
				);
				if (isOnlyToolResults) {
					return null;
				}
			}
			
			// Extract text content
			let textContent = "";
			if (typeof message.content === "string") {
				textContent = message.content;
			} else if (Array.isArray(message.content)) {
				// Extract text from content blocks
				textContent = message.content
					.filter((block: any) => block.type === "text")
					.map((block: any) => block.text)
					.join("\n");
			}

			// Skip empty messages
			if (!textContent.trim()) {
				return null;
			}

			// Format with appropriate tag based on role
			const tagName = message.role === "user" ? userTagName : assistantTagName;
			
			// Indent the content for better readability
			const indentedContent = textContent
				.split('\n')
				.map(line => `    ${line}`)
				.join('\n');
			
			return `  <${tagName}>\n${indentedContent}\n  </${tagName}>`;
		})
		.filter(Boolean) // Remove null entries
		.join("\n\n");
		
	// Format the conversation as XML with proper indentation
	return conversationContent;
} 