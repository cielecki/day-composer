import { StateCreator } from 'zustand';
import type { PluginStore } from '../store/plugin-store';

export enum SetupStep {
	CONFIGURE_LANGUAGE = "configure_language",
	CONFIGURE_ANTHROPIC_KEY = "configure_anthropic_key", 
	CONFIGURE_OPENAI_KEY = "configure_openai_key",
	COMPLETE = "complete"
}

export interface SetupState {
	currentStep: SetupStep;
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
      const hasLanguageConfigured = get().getObsidianLanguageConfigured();
      const hasAnthropicKey = Boolean(get().getSecret('ANTHROPIC_API_KEY') && get().getSecret('ANTHROPIC_API_KEY')!.trim().length > 0);
      const hasOpenAIKey = Boolean(get().getSecret('OPENAI_API_KEY') && get().getSecret('OPENAI_API_KEY')!.trim().length > 0);
      const hasOpenAISkipped = Boolean(get().settings.tutorial.openaiKeySkipped);
      
      let currentStep: SetupStep;
      
      if (!hasLanguageConfigured) {
        currentStep = SetupStep.CONFIGURE_LANGUAGE;
        console.log('→ Step: CONFIGURE_LANGUAGE (language not configured)');
      } else if (!hasAnthropicKey) {
        currentStep = SetupStep.CONFIGURE_ANTHROPIC_KEY;
        console.log('→ Step: CONFIGURE_ANTHROPIC_KEY (no Anthropic key)');
      } else if (!hasOpenAIKey && !hasOpenAISkipped) {
        currentStep = SetupStep.CONFIGURE_OPENAI_KEY;
        console.log('→ Step: CONFIGURE_OPENAI_KEY (no OpenAI key and not skipped)');
      } else {
        currentStep = SetupStep.COMPLETE;
        console.log('→ Step: COMPLETE (all requirements met)');
      }
      
      state.setup.currentStep = currentStep;
    } catch (error) {
      // If settings are not initialized yet, return default state
      console.log('Setup slice: Settings not initialized yet, using default state');
      state.setup.currentStep = SetupStep.CONFIGURE_LANGUAGE;
    }
  }),
  
  resetTutorialState: async () => {
    await get().resetTutorial();
    
    // Refresh state after resetting
    get().refreshSetupState();
  },
  
  isSetupComplete: () => {
    const state = get();
    return state.setup.currentStep === SetupStep.COMPLETE;
  }
}); 