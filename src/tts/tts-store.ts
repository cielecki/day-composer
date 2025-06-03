import { StateCreator } from 'zustand';

// TTS slice interface
export interface TTSSlice {
  // State
  tts: {
    isPlaying: boolean;
    isGenerating: boolean;
    isPaused: boolean;
    audioSrc: string | null;
  };
  
  // TTS Actions
  setTTSPlaying: (playing: boolean) => void;
  setTTSGenerating: (generating: boolean) => void;
  setTTSPaused: (paused: boolean) => void;
  setTTSAudioSrc: (src: string | null) => void;
  resetTTS: () => void;
}

// Type for StateCreator with immer middleware
type ImmerStateCreator<T> = StateCreator<
  T,
  [["zustand/immer", never]],
  [],
  T
>;

// Create TTS slice
export const createTTSSlice: ImmerStateCreator<TTSSlice> = (set) => ({
  tts: {
    isPlaying: false,
    isGenerating: false,
    isPaused: false,
    audioSrc: null
  },
  
  // TTS actions
  setTTSPlaying: (playing) => set((state) => {
    state.tts.isPlaying = playing;
  }),
  
  setTTSGenerating: (generating) => set((state) => {
    state.tts.isGenerating = generating;
  }),
  
  setTTSPaused: (paused) => set((state) => {
    state.tts.isPaused = paused;
  }),
  
  setTTSAudioSrc: (src) => set((state) => {
    state.tts.audioSrc = src;
  }),
  
  resetTTS: () => set((state) => {
    state.tts = {
      isPlaying: false,
      isGenerating: false,
      isPaused: false,
      audioSrc: null
    };
  })
}); 