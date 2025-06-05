import { NavigationTarget } from '../obsidian-tools';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';

// Image data interface for UI components (based on existing AttachedImage)
export interface AttachedImage {
	id: string;
	name: string;
	src: string; // base64 data URL (data:image/png;base64,...)
}

// Image data interface for API/storage
export interface ImageData {
	data: string; // base64 encoded data
	type: string; // MIME type like 'image/jpeg', 'image/png'
	name?: string; // original filename
	size?: number; // file size in bytes
}

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
export interface ToolExecutionContext<TInput = Record<string, unknown>> {
	// Execution environment
	plugin: LifeNavigatorPlugin;
	params: TInput;
	signal: AbortSignal;
	
	// Progress reporting (final message serves as result)
	progress(message: string): void;
	
	// Navigation targets (can be called multiple times during execution)
	addNavigationTarget(target: NavigationTarget): void;
	
	// Action text/label management (updates the tool's display text in chat)
	setLabel(text: string): void;
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


