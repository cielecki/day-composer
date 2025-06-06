import { t } from 'src/i18n';

/**
 * Format the conversation into a readable markdown string
 * @param conversation The conversation to format
 * @returns A formatted markdown representation of the conversation
 */
import { Message, ContentBlock, ToolUseBlock, ToolResultBlock } from '../../types/chat-types';

export function formatConversationContent(conversation: Message[]): string {
	if (!conversation || conversation.length === 0) {
		return t('errors.chat.noContent');
	}

	// Get the translated role names for markdown headers
	const userRoleName = t('chat.userMessage');
	const assistantRoleName = t('chat.assistantMessage');
	
	// Build a global map of all tool results from the entire conversation
	const globalToolResults = new Map<string, ToolResultBlock>();
	conversation.forEach((message) => {
		if (Array.isArray(message.content)) {
			message.content
				.filter((block: ContentBlock) => block.type === "tool_result")
				.forEach((block: ContentBlock) => {
					const toolResult = block as ToolResultBlock;
					globalToolResults.set(toolResult.tool_use_id, toolResult);
				});
		}
	});
	
	// Group consecutive messages by role and format them
	const groupedSections: string[] = [];
	let currentRole: string | null = null;
	let currentSectionContent: string[] = [];
	
	const flushCurrentSection = () => {
		if (currentRole && currentSectionContent.length > 0) {
			const roleHeader = currentRole === "user" ? userRoleName : assistantRoleName;
			const sectionContent = currentSectionContent.join("\n\n");
			groupedSections.push(`## ${roleHeader}\n\n${sectionContent}`);
			currentSectionContent = [];
		}
	};

	conversation.forEach((message) => {
		// Skip tool result messages
		if (message.role === "user" && Array.isArray(message.content)) {
			const isOnlyToolResults = message.content.every(
				(item: ContentBlock) =>
					typeof item === "object" &&
					item !== null &&
					"type" in item &&
					item.type === "tool_result"
			);
			if (isOnlyToolResults) {
				return;
			}
		}
		
		// Extract text content and tool use blocks
		let textContent = "";
		let toolUseBlocks: ToolUseBlock[] = [];
		
		if (typeof message.content === "string") {
			textContent = message.content;
		} else if (Array.isArray(message.content)) {
			// Extract text from content blocks
			textContent = message.content
				.filter((block: ContentBlock) => block.type === "text")
				.map((block: ContentBlock) => (block as any).text)
				.join("\n");
			
			// Extract tool use blocks
			toolUseBlocks = message.content
				.filter((block: ContentBlock) => block.type === "tool_use") as ToolUseBlock[];
		}

		// Skip messages with no text content and no tool use
		if (!textContent.trim() && toolUseBlocks.length === 0) {
			return;
		}

		// If role changed, flush the current section
		if (currentRole !== message.role) {
			flushCurrentSection();
			currentRole = message.role;
		}
		
		let messageContent = "";
		
		// Add text content if available
		if (textContent.trim()) {
			messageContent += textContent;
		}
		
		// Add tool use information if available
		if (toolUseBlocks.length > 0) {
			const toolLabels: string[] = [];
			toolUseBlocks.forEach((toolBlock) => {
				// Look up the tool result from the global map
				const toolResult = globalToolResults.get(toolBlock.id);
				const label = toolResult?.current_label;
				
				// Show label if it's different from the tool name and more descriptive, otherwise show tool name
				if (label && label !== toolBlock.name && label.trim() !== '') {
					toolLabels.push(`**${label}**`);
				} else {
					toolLabels.push(`**${toolBlock.name}**`);
				}
			});
			
			if (messageContent && toolLabels.length > 0) {
				messageContent += "\n\n" + toolLabels.join("\n\n");
			} else if (toolLabels.length > 0) {
				messageContent = toolLabels.join("\n\n");
			}
		}
		
		if (messageContent.trim()) {
			currentSectionContent.push(messageContent.trim());
		}
	});
	
	// Flush the final section
	flushCurrentSection();
	
	const conversationContent = groupedSections.join("\n\n---\n\n");
		
	return conversationContent;
} 