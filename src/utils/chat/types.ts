import { NavigationTarget } from '../../obsidian-tools';

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


