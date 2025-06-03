import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable MapSet plugin for Immer to support Map and Set in state
enableMapSet();

// Import slice interfaces and creators from their domain directories
import { ChatSlice, createChatSlice } from '../chat/chat-store';
import { ChatsDatabaseSlice, createChatsDatabaseSlice } from './chats-database-slice';
import { ModesSlice, createModesSlice } from '../modes/modes-slice';
import { TTSSlice, createTTSSlice } from '../tts/tts-slice';
import { STTSlice, createSTTSlice } from '../stt/stt-store';
import { SettingsSlice, createSettingsSlice } from '../settings/settings-slice';
import { SetupSlice, createSetupSlice } from '../setup/setup-slice';

// Combined store interface
export type PluginStore = ChatSlice & ChatsDatabaseSlice & ModesSlice & TTSSlice & STTSlice & SettingsSlice & SetupSlice;

// Create the combined store with proper slice pattern
export const usePluginStore = create<PluginStore>()(
  devtools(
    subscribeWithSelector(
      immer((...args) => ({
        // Spread all slices
        ...createChatSlice(...args),
        ...createChatsDatabaseSlice(...args),
        ...createModesSlice(...args),
        ...createTTSSlice(...args),
        ...createSTTSlice(...args),
        ...createSettingsSlice(...args),
        ...createSetupSlice(...args),
      }))
    ),
    { name: 'LifeNavigator' }
  )
);

// Helper functions for direct access (for plugin code)
export const getStoreState = () => usePluginStore.getState();
export const setStoreState = usePluginStore.setState; 