import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Import slice interfaces and creators from their domain directories
import { ChatSlice, createChatSlice } from '../chat/chat-store';
import { ModesSlice, createModesSlice } from '../modes/modes-slice';
import { TTSSlice, createTTSSlice } from '../tts/tts-store';
import { STTSlice, createSTTSlice } from '../stt/stt-store';
import { SettingsSlice, createSettingsSlice } from '../settings/settings-slice';
import { UISlice, createUISlice } from '../ui/ui-store';
import { LifeNavigatorSettings } from '../settings/LifeNavigatorSettings';

// Combined store interface
export type PluginStore = ChatSlice & ModesSlice & TTSSlice & STTSlice & SettingsSlice & UISlice & {
  // Cross-domain workflows
  workflows: {
    startVoiceConversation: () => Promise<void>;
    switchModeAndClearHistory: (modeId: string) => Promise<void>;
    resetAllState: () => void;
  };
};

// Create the combined store with proper slice pattern
export const usePluginStore = create<PluginStore>()(
  devtools(
    subscribeWithSelector(
      immer((...args) => ({
        // Spread all slices
        ...createChatSlice(...args),
        ...createModesSlice(...args),
        ...createTTSSlice(...args),
        ...createSTTSlice(...args),
        ...createSettingsSlice(...args),
        ...createUISlice(...args),
        
        // Cross-domain workflows
        workflows: {
          startVoiceConversation: async () => {
            const [, get] = args;
            const state = get();
            
            // Stop any current recording
            if (state.stt.isRecording) {
              state.setSTTRecording(false);
            }
            
            // Start new recording
            state.setSTTRecording(true);
            
            // TODO: Implement actual recording logic
          },
          
          switchModeAndClearHistory: async (modeId: string) => {
            const [, get] = args;
            const state = get();
            state.setActiveMode(modeId);
            state.clearChat();
          },
          
          resetAllState: () => {
            const [set] = args;
            set((state: PluginStore) => {
              // Reset all slices
              state.chats = {
                current: {
                  meta: {
                    id: '',
                    title: '',
                    filePath: '',
                    updatedAt: 0
                  },
                  storedConversation: {
                    version: 0,
                    modeId: '',
                    titleGenerated: false,
                    messages: []
                  }
                },
                isGenerating: false,
                editingMessage: null,
                liveToolResults: new Map(),
                conversationVersion: 0
              };
              
              state.modes = {
                available: {},
                activeId: '',
                isLoading: false,
                fileWatcherActive: false
              };
              
              state.tts = {
                isPlaying: false,
                isGenerating: false,
                isPaused: false,
                audioSrc: null
              };
              
              state.stt = {
                isRecording: false,
                isTranscribing: false,
                lastTranscription: null
              };
              
              state.settings = {
                settings: new LifeNavigatorSettings(),
                secrets: {},
                isLoading: false
              };
              
              state.ui = {
                setupComplete: false,
                chatHistoryOpen: false,
                menuOpen: false,
                dropdownOpen: false,
                sidebarCollapsed: false,
                loading: false
              };
            });
          }
        }
      }))
    ),
    { name: 'LifeNavigator' }
  )
);

// Helper functions for direct access (for plugin code)
export const getStoreState = () => usePluginStore.getState();
export const setStoreState = usePluginStore.setState; 