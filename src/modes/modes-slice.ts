import { StateCreator } from 'zustand';
import { LNMode } from '../utils/mode/LNMode';

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
  updateMode: (modeId: string, mode: LNMode) => void;
  removeMode: (modeId: string) => void;
  setModesLoading: (loading: boolean) => void;
  setFileWatcherActive: (active: boolean) => void;
}

// Type for StateCreator with immer middleware
type ImmerStateCreator<T> = StateCreator<
  T,
  [["zustand/immer", never]],
  [],
  T
>;

// Create modes slice
export const createModesSlice: ImmerStateCreator<ModesSlice> = (set) => ({
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