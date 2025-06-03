import { StateCreator } from 'zustand';
import { LifeNavigatorSettings } from './LifeNavigatorSettings';
import type { PluginStore } from '../store/plugin-store';

// Settings slice interface
export interface SettingsSlice {
  // State
  settings: {
    settings: LifeNavigatorSettings;
    secrets: Record<string, string>;
    isLoading: boolean;
  };
  
  // Actions
  updateSettings: (updates: Partial<LifeNavigatorSettings>) => void;
  setSettings: (settings: LifeNavigatorSettings) => void;
  setSecret: (key: string, value: string) => Promise<void>;
  removeSecret: (key: string) => Promise<void>;
  setSecrets: (secrets: Record<string, string>) => void;
  setSettingsLoading: (loading: boolean) => void;
  resetSettings: () => void;
  saveSettings: () => Promise<void>;
}

// Define the state creator type with immer
type ImmerStateCreator<T> = StateCreator<
  PluginStore,
  [["zustand/immer", never]],
  [],
  T
>;

// Create settings slice - now get() returns full PluginStore type
export const createSettingsSlice: ImmerStateCreator<SettingsSlice> = (set, get) => ({
  settings: {
    settings: new LifeNavigatorSettings(),
    secrets: {},
    isLoading: false
  },
  
  updateSettings: (updates) => set((state) => {
    Object.assign(state.settings.settings, updates);
  }),
  
  setSettings: (settings) => set((state) => {
    state.settings.settings = settings;
    state.settings.secrets = settings.secrets || {};
  }),
  
  setSecret: async (key, value) => {
    const state = get();
    
    // Update the store state
    set((state) => {
      state.settings.secrets[key] = value;
      // Also update the settings instance secrets
      if (!state.settings.settings.secrets) {
        state.settings.settings.secrets = {};
      }
      state.settings.settings.secrets[key] = value;
    });
    
    // Save to plugin data
    await state.settings.settings.saveSettings();
  },
  
  removeSecret: async (key) => {
    const state = get();
    
    // Update the store state
    set((state) => {
      delete state.settings.secrets[key];
      // Also update the settings instance secrets
      if (state.settings.settings.secrets) {
        delete state.settings.settings.secrets[key];
      }
    });
    
    // Save to plugin data
    await state.settings.settings.saveSettings();
  },
  
  setSecrets: (secrets) => set((state) => {
    state.settings.secrets = secrets;
    state.settings.settings.secrets = { ...secrets };
  }),
  
  setSettingsLoading: (loading) => set((state) => {
    state.settings.isLoading = loading;
  }),
  
  resetSettings: () => set((state) => {
    state.settings.settings = new LifeNavigatorSettings();
    state.settings.secrets = {};
    state.settings.isLoading = false;
  }),
  
  saveSettings: async () => {
    const state = get();
    await state.settings.settings.saveSettings();
  }
}); 