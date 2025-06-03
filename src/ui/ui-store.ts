import { PluginStore } from 'src/store/plugin-store';
import { StateCreator } from 'zustand';

// UI slice interface
export interface UISlice {
  // State
  ui: {
    setupComplete: boolean;
    chatHistoryOpen: boolean;
    menuOpen: boolean;
    dropdownOpen: boolean;
    sidebarCollapsed: boolean;
    loading: boolean;
  };
  
  // Actions
  setSetupComplete: (complete: boolean) => void;
  setChatHistoryOpen: (open: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  setDropdownOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setUILoading: (loading: boolean) => void;
  toggleConversationHistory: () => void;
  toggleMenu: () => void;
  toggleDropdown: () => void;
  toggleSidebar: () => void;
  resetUI: () => void;
}

// Type for StateCreator with immer middleware
type ImmerStateCreator<T> = StateCreator<
  T,
  [["zustand/immer", never]],
  [],
  T
>;

// Create UI slice
export const createUISlice: ImmerStateCreator<UISlice> = (set) => ({
  ui: {
    setupComplete: false,
    chatHistoryOpen: false,
    menuOpen: false,
    dropdownOpen: false,
    sidebarCollapsed: false,
    loading: false
  },
  
  setSetupComplete: (complete) => set((state: UISlice) => {
    state.ui.setupComplete = complete;
  }),
  
  setChatHistoryOpen: (open) => set((state: UISlice) => {
    state.ui.chatHistoryOpen = open;
  }),
  
  setMenuOpen: (open) => set((state: UISlice) => {
    state.ui.menuOpen = open;
  }),
  
  setDropdownOpen: (open) => set((state: UISlice) => {
    state.ui.dropdownOpen = open;
  }),
  
  setSidebarCollapsed: (collapsed) => set((state: UISlice) => {
    state.ui.sidebarCollapsed = collapsed;
  }),
  
  setUILoading: (loading) => set((state: UISlice) => {
    state.ui.loading = loading;
  }),
  
  toggleConversationHistory: () => set((state: UISlice) => {
    state.ui.chatHistoryOpen = !state.ui.chatHistoryOpen;
  }),
  
  toggleMenu: () => set((state: UISlice) => {
    state.ui.menuOpen = !state.ui.menuOpen;
  }),
  
  toggleDropdown: () => set((state: UISlice) => {
    state.ui.dropdownOpen = !state.ui.dropdownOpen;
  }),
  
  toggleSidebar: () => set((state: UISlice) => {
    state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
  }),
  
  resetUI: () => set((state: UISlice) => {
    state.ui = {
      setupComplete: false,
      chatHistoryOpen: false,
      menuOpen: false,
      dropdownOpen: false,
      sidebarCollapsed: false,
      loading: false
    };
  })
}); 