import { StateCreator } from 'zustand';
import { LifeNavigatorSettings } from './LifeNavigatorSettings';

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
  setSecret: (key: string, value: string) => void;
  removeSecret: (key: string) => void;
  setSecrets: (secrets: Record<string, string>) => void;
  setSettingsLoading: (loading: boolean) => void;
  resetSettings: () => void;
}

// Type for StateCreator with immer middleware
type ImmerStateCreator<T> = StateCreator<
  T,
  [["zustand/immer", never]],
  [],
  T
>;

// Create settings slice
export const createSettingsSlice: ImmerStateCreator<SettingsSlice> = (set) => ({
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
  
  setSecret: (key, value) => set((state) => {
    state.settings.secrets[key] = value;
  }),
  
  removeSecret: (key) => set((state) => {
    delete state.settings.secrets[key];
  }),
  
  setSecrets: (secrets) => set((state) => {
    state.settings.secrets = secrets;
  }),
  
  setSettingsLoading: (loading) => set((state) => {
    state.settings.isLoading = loading;
  }),
  
  resetSettings: () => set((state) => {
    state.settings.settings = new LifeNavigatorSettings();
    state.settings.secrets = {};
    state.settings.isLoading = false;
  })
}); 