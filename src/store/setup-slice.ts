import { StateCreator } from 'zustand';
import type { PluginStore } from '../store/plugin-store';
import { usePluginStore } from '../store/plugin-store';

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
  resetTutorialState: () => Promise<void>;
  isSetupComplete: () => boolean;
  subscribeToSetupChanges: () => () => void; // Returns unsubscribe function
}

// Type for StateCreator with immer middleware
type ImmerStateCreator<T> = StateCreator<
  PluginStore,
  [["zustand/immer", never]],
  [],
  T
>;


// Create setup slice
export const createSetupSlice: ImmerStateCreator<SetupSlice> = (set, get) => {
  const refreshSetupState = () => set((state) => {
    try {
      const hasLanguageConfigured = get().getObsidianLanguageConfigured();
      const hasAnthropicKey = Boolean(get().getSecret('ANTHROPIC_API_KEY') && get().getSecret('ANTHROPIC_API_KEY')!.trim().length > 0);
      const hasOpenAIKey = Boolean(get().getSecret('OPENAI_API_KEY') && get().getSecret('OPENAI_API_KEY')!.trim().length > 0);
      const hasOpenAISkipped = Boolean(get().settings.tutorial.openaiKeySkipped);
      
      let currentStep: SetupStep;
      
      if (!hasLanguageConfigured) {
        currentStep = SetupStep.CONFIGURE_LANGUAGE;
        console.debug('→ Step: CONFIGURE_LANGUAGE (language not configured)');
      } else if (!hasAnthropicKey) {
        currentStep = SetupStep.CONFIGURE_ANTHROPIC_KEY;
        console.debug('→ Step: CONFIGURE_ANTHROPIC_KEY (no Anthropic key)');
      } else if (!hasOpenAIKey && !hasOpenAISkipped) {
        currentStep = SetupStep.CONFIGURE_OPENAI_KEY;
        console.debug('→ Step: CONFIGURE_OPENAI_KEY (no OpenAI key and not skipped)');
      } else {
        currentStep = SetupStep.COMPLETE;
        console.debug('→ Step: COMPLETE (all requirements met)');
      }
      
      state.setup.currentStep = currentStep;
    } catch (error) {
      // If settings are not initialized yet, return default state
      console.debug('Setup slice: Settings not initialized yet, using default state');
      state.setup.currentStep = SetupStep.CONFIGURE_LANGUAGE;
    }
  });
  
  return {
    setup: {
      currentStep: SetupStep.CONFIGURE_LANGUAGE,
      hasLanguageConfigured: false,
      hasAnthropicKey: false,
      hasOpenAIKey: false,
      hasOpenAIConfigured: false,
      isRefreshing: false
    },
    
    resetTutorialState: async () => {
      await get().resetTutorial();
    },
    
    isSetupComplete: () => {
      const state = get();
      return state.setup.currentStep === SetupStep.COMPLETE;
    },

    subscribeToSetupChanges: () => {
      const unsubscribeFunctions: (() => void)[] = [];

      refreshSetupState();

      console.debug('Setting up setup state change subscriptions...');

      // Subscribe to language configuration changes
      const unsubLang = usePluginStore.subscribe(
        (state) => {
          try {
            return state.getObsidianLanguageConfigured();
          } catch {
            return false;
          }
        },
        (hasLanguageConfigured: boolean, prevHasLanguageConfigured: boolean) => {
          if (hasLanguageConfigured !== prevHasLanguageConfigured) {
            console.debug(`Language configuration changed: ${prevHasLanguageConfigured} → ${hasLanguageConfigured}`);
            refreshSetupState();
          }
        },
        { fireImmediately: false }
      );
      unsubscribeFunctions.push(unsubLang);

      // Subscribe to Anthropic API key changes
      const unsubAnthropic = usePluginStore.subscribe(
        (state) => {
          try {
            const key = state.getSecret('ANTHROPIC_API_KEY');
            return Boolean(key && key.trim().length > 0);
          } catch {
            return false;
          }
        },
        (hasAnthropicKey: boolean, prevHasAnthropicKey: boolean) => {
          if (hasAnthropicKey !== prevHasAnthropicKey) {
            console.debug(`Anthropic API key changed: ${prevHasAnthropicKey} → ${hasAnthropicKey}`);
            refreshSetupState();
          }
        },
        { fireImmediately: false }
      );
      unsubscribeFunctions.push(unsubAnthropic);

      // Subscribe to OpenAI API key changes
      const unsubOpenAI = usePluginStore.subscribe(
        (state) => {
          try {
            const key = state.getSecret('OPENAI_API_KEY');
            return Boolean(key && key.trim().length > 0);
          } catch {
            return false;
          }
        },
        (hasOpenAIKey: boolean, prevHasOpenAIKey: boolean) => {
          if (hasOpenAIKey !== prevHasOpenAIKey) {
            console.debug(`OpenAI API key changed: ${prevHasOpenAIKey} → ${hasOpenAIKey}`);
            refreshSetupState();
          }
        },
        { fireImmediately: false }
      );
      unsubscribeFunctions.push(unsubOpenAI);

      // Subscribe to OpenAI skip setting changes
      const unsubOpenAISkip = usePluginStore.subscribe(
        (state) => {
          try {
            return Boolean(state.settings.tutorial.openaiKeySkipped);
          } catch {
            return false;
          }
        },
        (openaiKeySkipped: boolean, prevOpenaiKeySkipped: boolean) => {
          if (openaiKeySkipped !== prevOpenaiKeySkipped) {
            console.debug(`OpenAI skip setting changed: ${prevOpenaiKeySkipped} → ${openaiKeySkipped}`);
            refreshSetupState();
          }
        },
        { fireImmediately: false }
      );
      unsubscribeFunctions.push(unsubOpenAISkip);

      console.debug('Setup state change subscriptions established');

      // Return a cleanup function that unsubscribes all
      return () => {
        console.debug('Cleaning up setup state change subscriptions...');
        unsubscribeFunctions.forEach(unsub => unsub());
      };
    }
  }
}; 