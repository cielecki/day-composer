import { NavigationTarget } from '../obsidian-tools';

// New block types based on Anthropic API for extended thinking
export interface TextBlock {
	type: "text";
	text: string;
}

export interface ImageBlock {
	type: "image";
	source: {
		type: "base64";
		media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp"; // Anthropic API supported types
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
	isProcessing?: boolean; // UI flag to track processing state
}

export interface ToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content: string;
	is_error?: boolean;
	is_complete?: boolean; // Flag to track if tool execution is finished
	navigation_targets?: NavigationTarget[];
	current_label?: string; // Current label set by setLabel() during execution
}

export interface ErrorMessageBlock {
	type: "error_message";
	text: string;
}

// Union type for all possible content blocks
export type ContentBlock =
	| TextBlock
	| ThinkingBlock
	| RedactedThinkingBlock
	| ToolUseBlock
	| ToolResultBlock
	| ImageBlock
	| ErrorMessageBlock;

export interface Message {
	role: "user" | "assistant";
	content: ContentBlock[];
}