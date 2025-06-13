import { ObsidianTool } from "../../obsidian-tools";
import { ToolUseBlock, ToolResultBlock } from "../../types/message";

export interface ToolProcessingResult {
	toolResults: ToolResultBlock[];
	abortedDuringProcessing: boolean;
}

/**
 * Processes tool use blocks and returns tool results with real-time progress updates
 */
export const processToolUseBlocks = async (
	toolUseBlocks: ToolUseBlock[],
	obsidianTools: ReturnType<typeof import("../../obsidian-tools").getObsidianTools>,
	signal: AbortSignal,
	chatId: string,
	onToolResultUpdate?: (toolId: string, result: ToolResultBlock) => void
): Promise<ToolProcessingResult> => {
	const toolResults: ToolResultBlock[] = [];
	let abortedDuringProcessing = false;

	for (const toolUseBlock of toolUseBlocks) {
		if (signal.aborted) {
			abortedDuringProcessing = true;
			break;
		}
		
		// Get the tool to access its initial label
		const tool = await obsidianTools.getToolByName(toolUseBlock.name);
		
		// Create initial incomplete result - this will serve as a base template
		let currentResult: ToolResultBlock = {
			type: "tool_result",
			tool_use_id: toolUseBlock.id,
			content: "",
			is_complete: false,
			navigation_targets: [],
			current_label: tool?.initialLabel // Set to tool's initial label immediately
		};
		
		try {
			const result = await obsidianTools.processToolCall(
				toolUseBlock.name,
				toolUseBlock.input,
				signal,
				chatId,
				(message: string) => {
					// Create new result object with updated content (immutable)
					const newContent = currentResult.content ? `${currentResult.content}\n${message}` : message;
					currentResult = {
						...currentResult,
						content: newContent
					};
					// Notify the UI about the update
					onToolResultUpdate?.(toolUseBlock.id, currentResult);
				},
				(navigationTarget) => {
					// Create new result object with updated navigation targets (immutable)
					currentResult = {
						...currentResult,
						navigation_targets: [...(currentResult.navigation_targets || []), navigationTarget]
					};
					// Notify the UI about the update
					onToolResultUpdate?.(toolUseBlock.id, currentResult);
				},
				(label: string) => {
					console.debug("label", label);
					// Create new result object with updated label (immutable)
					currentResult = {
						...currentResult,
						current_label: label
					};
					// Notify the UI about the update
					onToolResultUpdate?.(toolUseBlock.id, currentResult);
				}
			);
			
			// Mark as complete with final result
			const finalResult: ToolResultBlock = {
				type: "tool_result",
				tool_use_id: toolUseBlock.id,
				content: result.result,
				is_error: result.isError,
				is_complete: true,
				navigation_targets: result.navigationTargets,
				current_label: result.finalLabel
			};
			
			toolResults.push(finalResult);
			// Final update to mark as complete
			onToolResultUpdate?.(toolUseBlock.id, finalResult);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			const errorResult: ToolResultBlock = {
				type: "tool_result",
				tool_use_id: toolUseBlock.id,
				content: `Error: ${errorMessage}`,
				is_error: true,
				is_complete: true,
				current_label: currentResult.current_label // Keep last known label
			};
			toolResults.push(errorResult);
			// Update with error result
			onToolResultUpdate?.(toolUseBlock.id, errorResult);
		}
	}

	return {
		toolResults,
		abortedDuringProcessing
	};
}; 