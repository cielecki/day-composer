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

export interface AICMode {
	// Core identification
	aic_name: string;
	aic_path: string;

	// UI elements
	aic_icon: string;
	aic_icon_color: string;
	aic_description: string; // Used in UI to show what this mode does

	// Behavior
	aic_system_prompt: string; // The main content becomes this
	aic_example_usages: string[]; // Message to automatically send when mode is activated

	// API parameters
	aic_thinking_budget_tokens: number;
	aic_max_tokens: number;

	// TTS settings
	aic_voice_autoplay: boolean;
	aic_voice: string;
	aic_voice_instructions: string;
	aic_voice_speed: number;
}
