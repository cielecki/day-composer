import { StateCreator } from 'zustand';
import { LNMode } from '../utils/mode/LNMode';
import type { PluginStore } from '../store/plugin-store';

// Modes slice interface
export interface ModesSlice {
  // State
  modes: {
    available: Record<string, LNMode>;
    activeId: string;
    isLoading: boolean;
    fileWatcherActive: boolean;
  };
  
  // Actions
  setAvailableModes: (modes: Record<string, LNMode>) => void;
  setActiveMode: (modeId: string) => void;
  setActiveModeWithPersistence: (modeId: string) => Promise<void>;
  updateMode: (modeId: string, mode: LNMode) => void;
  removeMode: (modeId: string) => void;
  setModesLoading: (loading: boolean) => void;
  setFileWatcherActive: (active: boolean) => void;
}

// Type for StateCreator with immer middleware - updated to use PluginStore
type ImmerStateCreator<T> = StateCreator<
  PluginStore,
  [["zustand/immer", never]],
  [],
  T
>;

export const createModesSlice: ImmerStateCreator<ModesSlice> = (set, get) => ({
  modes: {
    available: {},
    activeId: '',
    isLoading: false,
    fileWatcherActive: false
  },
  
  setAvailableModes: (modes) => set((state) => {
    state.modes.available = modes;
  }),
  
  setActiveMode: (modeId) => set((state) => {
    state.modes.activeId = modeId;
  }),
  
  setActiveModeWithPersistence: async (modeId) => {
    // Update store state
    set((state) => {
      state.modes.activeId = modeId;
    });
    
    // Persist to settings
    const { getPluginSettings } = await import('../settings/LifeNavigatorSettings');
    const settings = getPluginSettings();
    settings.activeModeId = modeId;
    await settings.saveSettings();
  },
  
  updateMode: (modeId, mode) => set((state) => {
    state.modes.available[modeId] = mode;
  }),
  
  removeMode: (modeId) => set((state) => {
    delete state.modes.available[modeId];
  }),
  
  setModesLoading: (loading) => set((state) => {
    state.modes.isLoading = loading;
  }),
  
  setFileWatcherActive: (active) => set((state) => {
    state.modes.fileWatcherActive = active;
  })
}); 