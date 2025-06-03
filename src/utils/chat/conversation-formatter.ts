import { t } from '../../i18n';

/**
 * Format the conversation into a readable markdown string
 * @param conversation The conversation to format
 * @returns A formatted markdown representation of the conversation
 */
export function formatConversationContent(conversation: any[]): string {
	if (!conversation || conversation.length === 0) {
		return t('errors.chat.noContent');
	}

	// Get the translated role names for markdown headers
	const userRoleName = t('chat.userMessage');
	const assistantRoleName = t('chat.assistantMessage');
	
	// Build a formatted representation of the conversation with markdown headers
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

			// Format with appropriate markdown header based on role
			const roleName = message.role === "user" ? userRoleName : assistantRoleName;
			
			// Use markdown format with proper headers
			return `## ${roleName}\n\n${textContent}`;
		})
		.filter(Boolean) // Remove null entries
		.join("\n\n---\n\n");
		
	return conversationContent;
} 