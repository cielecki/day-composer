export interface LNMode {
	// Core identification
	name: string;
	path: string;

	// UI elements
	icon: string;
	icon_color: string;
	description: string; // Used in UI to show what this mode does

	// Common attributes (shared with tools)
	version?: string; // Version for tracking mode evolution
	enabled?: boolean; // Whether the mode is enabled (default: true)

	// Behavior
	system_prompt: string; // The main content becomes this
	example_usages: string[]; // Message to automatically send when mode is activated
	expand_links: boolean; // Whether to expand wikilinks in content (default: true)

	// API parameters
	model: string; // Anthropic model to use (e.g., "claude-sonnet-4-20250514")
	thinking_budget_tokens: number;
	max_tokens: number;

	// TTS settings
	voice_autoplay: boolean;
	voice: string;
	voice_instructions: string;
	voice_speed: number;

	// Tool filtering
	tools_allowed?: string[]; // Array of patterns for allowed tools (default: ["*"])
	tools_disallowed?: string[]; // Array of patterns for disallowed tools (default: [])
}
