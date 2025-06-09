import { LNMode } from 'src/types/LNMode';
import { TTS_VOICES, TTSVoice } from "src/store/audio-slice";

// Available Anthropic models
export const ANTHROPIC_MODELS = [
  "auto",                          // Auto-select based on mode characteristics
  "claude-opus-4-20250514",        // Claude Opus 4 - Most capable
  "claude-sonnet-4-20250514",      // Claude Sonnet 4 - High performance
  "claude-3-5-haiku-20241022",     // Claude Haiku 3.5 - Fastest
  "claude-3-7-sonnet-20250219",    // Claude Sonnet 3.7 - Current default
  "claude-3-5-sonnet-20241022",    // Claude Sonnet 3.5 v2
  "claude-3-5-sonnet-20240620",    // Claude Sonnet 3.5 v1
] as const;

export type AnthropicModel = typeof ANTHROPIC_MODELS[number];

export const DEFAULT_VOICE_INSTRUCTIONS = `
Voice: Warm, empathetic, and professional, reassuring the customer that their issue is understood and will be resolved.

Punctuation: Well-structured with natural pauses, allowing for clarity and a steady, calming flow.

Delivery: Calm and patient, with a supportive and understanding tone that reassures the listener.

Phrasing: Clear and concise, using customer-friendly language that avoids jargon while maintaining professionalism.

Tone: Empathetic and solution-focused, emphasizing both understanding and proactive assistance.
`;

/**
 * Automatically selects the best model based on mode characteristics
 * @param mode The LN mode to analyze
 * @returns The recommended model for this mode
 */
export function resolveAutoModel(mode: LNMode): string {
  return "claude-sonnet-4-20250514";
}

/**
 * Default configuration for LN modes.
 * These values will be used when a mode doesn't specify certain parameters.
 */
export function getDefaultLNMode(): LNMode {
  return {
    // UI defaults
    name: "",
    path: "",
    icon: "brain",
    icon_color: "#888888",
    description: "",
    
    // Common attributes (shared with tools)
    version: undefined, // No default version
    enabled: true, // Enabled by default
    
    // Behavior defaults
    system_prompt: "",
    example_usages: [],
    expand_links: true, // Expand wikilinks by default
    
    // API parameters
    model: "auto", // Default to auto-selection
    thinking_budget_tokens: 1024,
    max_tokens: 4096,
    
    // TTS defaults
    voice_autoplay: true,
    voice: "alloy",
    voice_instructions: DEFAULT_VOICE_INSTRUCTIONS,
    voice_speed: 1.0,

    // Tool filtering defaults
    tools_allowed: ["*"], // Allow all tools by default
    tools_disallowed: [], // Disallow nothing by default
  }
}

/**
 * Merge user-defined LN mode with default values
 * @param userMode The user-defined LN mode
 * @returns Complete LN mode with all required fields
 */
export function mergeWithDefaultMode(userMode: Partial<LNMode>): LNMode {
  return validateModeSettings({
    ...getDefaultLNMode(),
    ...userMode,
  } as LNMode);
}

export function validateModeSettings(mode: LNMode): LNMode {
  const validatedMode = { ...mode };
  const defaultMode = getDefaultLNMode();
  
  // Validate model if present (allow "auto" as a valid option)
  if (mode.model && !ANTHROPIC_MODELS.includes(mode.model as AnthropicModel)) {
    console.warn(`Invalid model selected: ${mode.model}, falling back to auto`);
    validatedMode.model = "auto";
  }
  
  // Validate voice if present
  if (mode.voice && !TTS_VOICES.includes(mode.voice as TTSVoice)) {
    console.warn(`Invalid voice selected: ${mode.voice}, falling back to default`);
    validatedMode.voice = defaultMode.voice;
  }
  
  // Validate thinking budget (must be positive number)
  if (mode.thinking_budget_tokens !== undefined && 
      (typeof mode.thinking_budget_tokens !== 'number' || 
       mode.thinking_budget_tokens < 1024)) {
    validatedMode.thinking_budget_tokens = defaultMode.thinking_budget_tokens;
  }
  
  // Validate max tokens (must be positive number)
  if (mode.max_tokens !== undefined && 
      (typeof mode.max_tokens !== 'number' || 
       mode.max_tokens <= 0)) {
    validatedMode.max_tokens = defaultMode.max_tokens;
  }
  
  return validatedMode;
}
