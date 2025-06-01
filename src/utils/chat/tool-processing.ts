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
	onProgress?: (toolId: string, message: string) => void
): Promise<ToolProcessingResult> => {
	const toolResults: ToolResultBlock[] = [];
	let abortedDuringProcessing = false;

	for (const toolUseBlock of toolUseBlocks) {
		if (signal.aborted) {
			abortedDuringProcessing = true;
			break;
		}
		
		try {
			const result = await obsidianTools.processToolCall(
				toolUseBlock.name,
				toolUseBlock.input,
				signal,
				(message: string) => {
					// Call progress callback if provided
					onProgress?.(toolUseBlock.id, message);
				},
				(navigationTarget) => {
					// Navigation targets are collected within the processToolCall method
					// and will be included in the final result
				}
			);
			
			toolResults.push({
				type: "tool_result",
				tool_use_id: toolUseBlock.id,
				content: result.result,
				is_error: result.isError,
				navigationTargets: result.navigationTargets
			});
		} catch (error: any) {
			toolResults.push({
				type: "tool_result",
				tool_use_id: toolUseBlock.id,
				content: `Error: ${error.message || "Unknown error"}`,
				is_error: true,
			});
		}
	}

	return {
		toolResults,
		abortedDuringProcessing
	};
}; 