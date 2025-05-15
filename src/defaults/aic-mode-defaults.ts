import { AICMode } from "../types/types";
import { TTS_VOICES, TTSVoice } from "../settings/PluginSettings";
import { t } from '../i18n';

/**
 * Default configuration for AIC modes.
 * These values will be used when a mode doesn't specify certain parameters.
 */
export const DEFAULT_AIC_MODE: AICMode = {
  // UI defaults
  aic_name: t('modes.default.name'),
  aic_path: "",
  aic_icon: "brain",
  aic_icon_color: "#888888",
  aic_description: t('modes.default.description'),
  
  // Behavior defaults
  aic_system_prompt: t('modes.default.systemPrompt'),
  aic_example_usages: [],
  
  // API parameters
  aic_thinking_budget_tokens: 2000,
  aic_max_tokens: 4096,
  
  // TTS defaults
  aic_voice_autoplay: true,
  aic_voice: "alloy",
  aic_voice_instructions: t('voice.instructions.default'),
  aic_voice_speed: 1.0,
};

/**
 * Merge user-defined AIC mode with default values
 * @param userMode The user-defined AIC mode
 * @returns Complete AIC mode with all required fields
 */
export function mergeWithDefaultMode(userMode: Partial<AICMode>): AICMode {
  // Type assertion is safe because DEFAULT_AIC_MODE provides all required fields
  // that aren't required in the user's mode
  return {
    ...DEFAULT_AIC_MODE,
    ...userMode,
  } as AICMode;
}

export function validateModeSettings(mode: AICMode): AICMode {
  const validatedMode = { ...mode };
  
  // Validate voice if present
  if (mode.aic_voice && !TTS_VOICES.includes(mode.aic_voice as TTSVoice)) {
    console.warn(`Invalid voice selected: ${mode.aic_voice}, falling back to default`);
    validatedMode.aic_voice = DEFAULT_AIC_MODE.aic_voice;
  }
  
  // Validate thinking budget (must be positive number)
  if (mode.aic_thinking_budget_tokens !== undefined && 
      (typeof mode.aic_thinking_budget_tokens !== 'number' || 
       mode.aic_thinking_budget_tokens < 0)) {
    validatedMode.aic_thinking_budget_tokens = DEFAULT_AIC_MODE.aic_thinking_budget_tokens;
  }
  
  // Validate max tokens (must be positive number)
  if (mode.aic_max_tokens !== undefined && 
      (typeof mode.aic_max_tokens !== 'number' || 
       mode.aic_max_tokens <= 0)) {
    validatedMode.aic_max_tokens = DEFAULT_AIC_MODE.aic_max_tokens;
  }
  
  return validatedMode;
}
