import { NavigationTarget } from '../../obsidian-tools';
import MyPlugin from '../../main';

export interface Message {
	role: "user" | "assistant";
	content: string | ToolResult[] | ContentBlock[];
	hasToolResults?: boolean;
}

export interface ToolResult {
	type: "tool_result";
	tool_use_id: string;
	content: string;
}

export interface MessageWithToolResults {
	role: "user" | "assistant";
	content: string | ToolResult[];
}

// Tool Execution Context for the new context-based tool system
export interface ToolExecutionContext<TInput = any> {
	// Execution environment
	plugin: MyPlugin;
	params: TInput;
	signal: AbortSignal;
	
	// Progress reporting (final message serves as result)
	progress(message: string): void;
	
	// Navigation targets (can be called multiple times during execution)
	addNavigationTarget(target: NavigationTarget): void;
}

// New block types based on Anthropic API for extended thinking
export interface TextBlock {
	type: "text";
	text: string;
}

export interface ImageBlock {
	type: "image";
	source: {
		type: "base64";
		media_type: string; // e.g., "image/jpeg"
		data: string; // Base64 encoded image data
	};
}

export interface ThinkingBlock {
	type: "thinking";
	thinking: string;
	signature?: string;
	reasoningInProgress?: boolean;
}

export interface RedactedThinkingBlock {
	type: "redacted_thinking";
	data: string;
}

export interface ToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: Record<string, string | boolean | number | undefined>;
}

export interface ToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content: string;
	is_error?: boolean;
	is_complete?: boolean; // Flag to track if tool execution is finished
	navigationTargets?: NavigationTarget[];
}

// Union type for all possible content blocks
export type ContentBlock =
	| TextBlock
	| ThinkingBlock
	| RedactedThinkingBlock
	| ToolUseBlock
	| ToolResultBlock
	| ImageBlock;

export interface ObsidianToolInput {
	[key: string]: string | boolean | number | undefined;
}

export interface ToolUseResult {
	success: boolean;
	result: string;
	error?: string;
}


