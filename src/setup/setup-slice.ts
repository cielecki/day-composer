import { StateCreator } from 'zustand';
import type { PluginStore } from '../store/plugin-store';
import { getPluginSettings } from '../settings/LifeNavigatorSettings';

export enum SetupStep {
	CONFIGURE_LANGUAGE = "configure_language",
	CONFIGURE_ANTHROPIC_KEY = "configure_anthropic_key", 
	CONFIGURE_OPENAI_KEY = "configure_openai_key",
	COMPLETE = "complete"
}

export interface SetupState {
	currentStep: SetupStep;
	hasLanguageConfigured: boolean;
	hasAnthropicKey: boolean;
	hasOpenAIKey: boolean;
	hasOpenAIConfigured: boolean;
}

// Setup slice interface
export interface SetupSlice {
  // State
  setup: SetupState;
  
  // Actions
  refreshSetupState: () => void;
  resetTutorialState: () => Promise<void>;
  isSetupComplete: () => boolean;
}

// Type for StateCreator with immer middleware
type ImmerStateCreator<T> = StateCreator<
  PluginStore,
  [["zustand/immer", never]],
  [],
  T
>;


// Create setup slice
export const createSetupSlice: ImmerStateCreator<SetupSlice> = (set, get) => ({
  setup: {
    currentStep: SetupStep.CONFIGURE_LANGUAGE,
    hasLanguageConfigured: false,
    hasAnthropicKey: false,
    hasOpenAIKey: false,
    hasOpenAIConfigured: false,
    isRefreshing: false
  },
  
  refreshSetupState: () => set((state) => {
    try {
      const settings = getPluginSettings();
      
      const hasLanguageConfigured = settings.tutorial.obsidianLanguageConfigured;
      const hasAnthropicKey = Boolean(settings.getSecret('ANTHROPIC_API_KEY') && settings.getSecret('ANTHROPIC_API_KEY')!.trim().length > 0);
      const hasOpenAIKey = Boolean(settings.getSecret('OPENAI_API_KEY') && settings.getSecret('OPENAI_API_KEY')!.trim().length > 0);
      const hasOpenAIConfigured = settings.tutorial.openaiKeyConfigured;
      
      
      let currentStep: SetupStep;
      
      if (!hasLanguageConfigured) {
        currentStep = SetupStep.CONFIGURE_LANGUAGE;
        console.log('→ Step: CONFIGURE_LANGUAGE (language not configured)');
      } else if (!hasAnthropicKey) {
        currentStep = SetupStep.CONFIGURE_ANTHROPIC_KEY;
        console.log('→ Step: CONFIGURE_ANTHROPIC_KEY (no Anthropic key)');
      } else if (!hasOpenAIKey && !hasOpenAIConfigured) {
        currentStep = SetupStep.CONFIGURE_OPENAI_KEY;
        console.log('→ Step: CONFIGURE_OPENAI_KEY (no OpenAI key and not configured)');
      } else {
        currentStep = SetupStep.COMPLETE;
        console.log('→ Step: COMPLETE (all requirements met)');
      }
      
      state.setup.currentStep = currentStep;
      state.setup.hasLanguageConfigured = hasLanguageConfigured;
      state.setup.hasAnthropicKey = hasAnthropicKey;
      state.setup.hasOpenAIKey = hasOpenAIKey;
      state.setup.hasOpenAIConfigured = hasOpenAIConfigured;
    } catch (error) {
      // If settings are not initialized yet, return default state
      console.log('Setup slice: Settings not initialized yet, using default state');
      state.setup.currentStep = SetupStep.CONFIGURE_LANGUAGE;
      state.setup.hasLanguageConfigured = false;
      state.setup.hasAnthropicKey = false;
      state.setup.hasOpenAIKey = false;
      state.setup.hasOpenAIConfigured = false;
    }
  }),
  
  resetTutorialState: async () => {
    const { getPluginSettings } = await import('../settings/LifeNavigatorSettings');
    const settings = getPluginSettings();
    settings.tutorial.obsidianLanguageConfigured = false;
    settings.tutorial.openaiKeyConfigured = false;
    await settings.saveSettings();
    
    // Refresh state after resetting
    get().refreshSetupState();
  },
  
  isSetupComplete: () => {
    const state = get();
    return state.setup.currentStep === SetupStep.COMPLETE;
  }
}); 