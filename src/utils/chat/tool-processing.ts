import { ObsidianTool } from "../../obsidian-tools";
import { ToolUseBlock, ToolResultBlock } from "./types";

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
	onToolResultUpdate?: (toolId: string, result: ToolResultBlock) => void
): Promise<ToolProcessingResult> => {
	const toolResults: ToolResultBlock[] = [];
	let abortedDuringProcessing = false;

	for (const toolUseBlock of toolUseBlocks) {
		if (signal.aborted) {
			abortedDuringProcessing = true;
			break;
		}
		
		// Create initial incomplete result
		const initialResult: ToolResultBlock = {
			type: "tool_result",
			tool_use_id: toolUseBlock.id,
			content: "",
			is_complete: false,
			navigation_targets: [],
			current_label: undefined // Will be set by tool's initial label
		};
		
		try {
			const result = await obsidianTools.processToolCall(
				toolUseBlock.name,
				toolUseBlock.input,
				signal,
				(message: string) => {
					// Update the result content progressively
					initialResult.content = initialResult.content ? `${initialResult.content}\n${message}` : message;
					// Notify the UI about the update
					onToolResultUpdate?.(toolUseBlock.id, { ...initialResult });
				},
				(navigationTarget) => {
					// Add navigation targets as they become available
					initialResult.navigation_targets = initialResult.navigation_targets || [];
					initialResult.navigation_targets.push(navigationTarget);
					// Notify the UI about the update
					onToolResultUpdate?.(toolUseBlock.id, { ...initialResult });
				},
				(label: string) => {
					// Update the current label
					initialResult.current_label = label;
					// Notify the UI about the update
					onToolResultUpdate?.(toolUseBlock.id, { ...initialResult });
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
		} catch (error: any) {
			const errorResult: ToolResultBlock = {
				type: "tool_result",
				tool_use_id: toolUseBlock.id,
				content: `Error: ${error.message || "Unknown error"}`,
				is_error: true,
				is_complete: true,
				current_label: initialResult.current_label // Keep last known label
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