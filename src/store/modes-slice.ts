import { LNMode } from '../types/mode';
import type { ImmerStateCreator } from './plugin-store';

// Modes slice interface
export interface ModesSlice {
  // State
  modes: {
    available: Record<string, LNMode>;
    activeId: string;
    isLoading: boolean;
    fileWatcherActive: boolean;
  };
  
  // Validation state
  validation: {
    invalidModes: string[]; // List of mode paths/IDs with validation issues
    invalidTools: string[]; // List of tool paths/IDs with validation issues
  };
  
  // Actions
  setAvailableModes: (modes: Record<string, LNMode>) => void;
  setActiveMode: (modeId: string) => void;
  setActiveModeWithPersistence: (modeId: string) => Promise<void>;
  updateMode: (modeId: string, mode: LNMode) => void;
  removeMode: (modeId: string) => void;
  setModesLoading: (loading: boolean) => void;
  setFileWatcherActive: (active: boolean) => void;
  
  // Validation actions
  setInvalidModes: (modeIds: string[]) => void;
  setInvalidTools: (toolIds: string[]) => void;
  addInvalidMode: (modeId: string) => void;
  addInvalidTool: (toolId: string) => void;
  removeInvalidMode: (modeId: string) => void;
  removeInvalidTool: (toolId: string) => void;
  clearModeValidationErrors: () => void;
  clearToolValidationErrors: () => void;
}

export const createModesSlice: ImmerStateCreator<ModesSlice> = (set, get) => ({
  modes: {
    available: {},
    activeId: '',
    isLoading: false,
    fileWatcherActive: false
  },
  
  validation: {
    invalidModes: [],
    invalidTools: []
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
    const store = get();
    store.updateSettings({ activeModeId: modeId });
    await store.saveSettings();
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
  }),
  
  // Validation actions
  setInvalidModes: (modeIds) => set((state) => {
    state.validation.invalidModes = modeIds;
  }),
  
  setInvalidTools: (toolIds) => set((state) => {
    state.validation.invalidTools = toolIds;
  }),
  
  addInvalidMode: (modeId) => set((state) => {
    if (!state.validation.invalidModes.includes(modeId)) {
      state.validation.invalidModes.push(modeId);
    }
  }),
  
  addInvalidTool: (toolId) => set((state) => {
    if (!state.validation.invalidTools.includes(toolId)) {
      state.validation.invalidTools.push(toolId);
    }
  }),
  
  removeInvalidMode: (modeId) => set((state) => {
    state.validation.invalidModes = state.validation.invalidModes.filter(id => id !== modeId);
  }),
  
  removeInvalidTool: (toolId) => set((state) => {
    state.validation.invalidTools = state.validation.invalidTools.filter(id => id !== toolId);
  }),
  
  clearModeValidationErrors: () => set((state) => {
    state.validation.invalidModes = [];
  }),

  clearToolValidationErrors: () => set((state) => {
    state.validation.invalidTools = [];
  })
}); 