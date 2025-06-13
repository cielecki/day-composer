import { LNMode } from '../types/mode';
import type { ImmerStateCreator } from './plugin-store';
import { expandLinks, SystemPromptParts } from 'src/utils/links/expand-links';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';

// Modes slice interface
export interface ModesSlice {
  // State
  modes: {
    available: Record<string, LNMode>;
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
  updateMode: (modeId: string, mode: LNMode) => void;
  removeMode: (modeId: string) => void;
  setModesLoading: (loading: boolean) => void;
  setFileWatcherActive: (active: boolean) => void;
  
  // Business logic
  getSystemPrompt: (modeId: string) => Promise<SystemPromptParts>;
  
  // Validation actions
  setInvalidModes: (modeIds: string[]) => void;
  setInvalidTools: (toolIds: string[]) => void;
  addInvalidMode: (modeId: string) => void;
  addInvalidTool: (toolId: string) => void;
  removeInvalidMode: (modeId: string) => void;
  removeInvalidTool: (toolId: string) => void;
  clearModeValidationErrors: () => void;
  clearToolValidationErrors: () => void;
  
  // No longer needed - use DEFAULT_MODE_ID constant instead
}

export const createModesSlice: ImmerStateCreator<ModesSlice> = (set, get) => ({
  modes: {
    available: {},
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

  // Business Logic Implementation
  getSystemPrompt: async (modeId: string) => {
    const state = get();
    
    const currentActiveMode = state.modes.available[modeId];
    const plugin = LifeNavigatorPlugin.getInstance();
    
    if (!currentActiveMode || !plugin) {
      return {
        staticSection: '',
        semiDynamicSection: '',
        dynamicSection: '',
        fullContent: ''
      };
    }
    
    // Conditionally expand links based on mode setting
    if (currentActiveMode.expand_links) {
      return (await expandLinks(plugin.app, currentActiveMode.system_prompt));
    } else {
      return {
        staticSection: currentActiveMode.system_prompt.trim(),
        semiDynamicSection: '',
        dynamicSection: '',
        fullContent: currentActiveMode.system_prompt.trim()
      };
    }
  },
  
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
  }),
  
  // No longer needed - use DEFAULT_MODE_ID constant instead
}); 