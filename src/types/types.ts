import { NavigationTarget } from '../obsidian-tools';

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

export interface LNMode {
	// Core identification
	ln_name: string;
	ln_path: string;

	// UI elements
	ln_icon: string;
	ln_icon_color: string;
	ln_description: string; // Used in UI to show what this mode does

	// Behavior
	ln_system_prompt: string; // The main content becomes this
	ln_example_usages: string[]; // Message to automatically send when mode is activated

	// API parameters
	ln_model: string; // Anthropic model to use (e.g., "claude-sonnet-4-20250514")
	ln_thinking_budget_tokens: number;
	ln_max_tokens: number;

	// TTS settings
	ln_voice_autoplay: boolean;
	ln_voice: string;
	ln_voice_instructions: string;
	ln_voice_speed: number;

	// Tool filtering
	ln_tools_allowed?: string[]; // Array of patterns for allowed tools (default: ["*"])
	ln_tools_disallowed?: string[]; // Array of patterns for disallowed tools (default: [])
}
