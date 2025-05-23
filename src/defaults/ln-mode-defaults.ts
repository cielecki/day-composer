import { LNMode } from "../types/types";
import { TTS_VOICES, TTSVoice } from "../settings/PluginSettings";


export const DEFAULT_VOICE_INSTRUCTIONS = `
Voice: Warm, empathetic, and professional, reassuring the customer that their issue is understood and will be resolved.

Punctuation: Well-structured with natural pauses, allowing for clarity and a steady, calming flow.

Delivery: Calm and patient, with a supportive and understanding tone that reassures the listener.

Phrasing: Clear and concise, using customer-friendly language that avoids jargon while maintaining professionalism.

Tone: Empathetic and solution-focused, emphasizing both understanding and proactive assistance.
`;

/**
 * Default configuration for LN modes.
 * These values will be used when a mode doesn't specify certain parameters.
 */
export function getDefaultLNMode(): LNMode {
  return {
    // UI defaults
    ln_name: "",
    ln_path: "",
    ln_icon: "brain",
    ln_icon_color: "#888888",
    ln_description: "",
    
    // Behavior defaults
    ln_system_prompt: "",
    ln_example_usages: [],
    
    // API parameters
    ln_thinking_budget_tokens: 1024,
    ln_max_tokens: 4096,
    
    // TTS defaults
    ln_voice_autoplay: true,
    ln_voice: "alloy",
    ln_voice_instructions: DEFAULT_VOICE_INSTRUCTIONS,
    ln_voice_speed: 1.0,
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
  
  // Validate voice if present
  if (mode.ln_voice && !TTS_VOICES.includes(mode.ln_voice as TTSVoice)) {
    console.warn(`Invalid voice selected: ${mode.ln_voice}, falling back to default`);
    validatedMode.ln_voice = defaultMode.ln_voice;
  }
  
  // Validate thinking budget (must be positive number)
  if (mode.ln_thinking_budget_tokens !== undefined && 
      (typeof mode.ln_thinking_budget_tokens !== 'number' || 
       mode.ln_thinking_budget_tokens < 1024)) {
    validatedMode.ln_thinking_budget_tokens = defaultMode.ln_thinking_budget_tokens;
  }
  
  // Validate max tokens (must be positive number)
  if (mode.ln_max_tokens !== undefined && 
      (typeof mode.ln_max_tokens !== 'number' || 
       mode.ln_max_tokens <= 0)) {
    validatedMode.ln_max_tokens = defaultMode.ln_max_tokens;
  }

  console.log("validatedMode", validatedMode);
  
  return validatedMode;
}
