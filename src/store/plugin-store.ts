import { create, StateCreator } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable MapSet plugin for Immer to support Map and Set in state
enableMapSet();

import { ChatSlice, createChatSlice } from './chat-store';
import { ChatsDatabaseSlice, createChatsDatabaseSlice } from './chats-database-slice';
import { ModesSlice, createModesSlice } from './modes-slice';
import { TTSSlice, createTTSSlice } from './tts-slice';
import { STTSlice, createSTTSlice } from './stt-store';
import { SettingsSlice, createSettingsSlice } from './settings-slice';
import { SetupSlice, createSetupSlice } from './setup-slice';

export type PluginStore = ChatSlice & ChatsDatabaseSlice & ModesSlice & TTSSlice & STTSlice & SettingsSlice & SetupSlice;

export type ImmerStateCreator<T> = StateCreator<
  PluginStore,
  [["zustand/immer", never]],
  [],
  T
>;

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
export const getStore = () => usePluginStore.getState();
export const setStore = usePluginStore.setState; 