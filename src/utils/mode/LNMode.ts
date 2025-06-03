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
	ln_expand_links: boolean; // Whether to expand wikilinks in content (default: true)


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
