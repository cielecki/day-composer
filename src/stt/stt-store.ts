import { StateCreator } from 'zustand';

// STT slice interface
export interface STTSlice {
  // State
  stt: {
    isRecording: boolean;
    isTranscribing: boolean;
    lastTranscription: string | null;
  };
  
  // STT Actions
  setSTTRecording: (recording: boolean) => void;
  setSTTTranscribing: (transcribing: boolean) => void;
  setLastTranscription: (transcription: string | null) => void;
  resetSTT: () => void;
}

// Type for StateCreator with immer middleware
type ImmerStateCreator<T> = StateCreator<
  T,
  [["zustand/immer", never]],
  [],
  T
>;

// Create STT slice
export const createSTTSlice: ImmerStateCreator<STTSlice> = (set) => ({
  stt: {
    isRecording: false,
    isTranscribing: false,
    lastTranscription: null
  },
  
  // STT actions
  setSTTRecording: (recording) => set((state) => {
    state.stt.isRecording = recording;
  }),
  
  setSTTTranscribing: (transcribing) => set((state) => {
    state.stt.isTranscribing = transcribing;
  }),
  
  setLastTranscription: (transcription) => set((state) => {
    state.stt.lastTranscription = transcription;
  }),
  
  resetSTT: () => set((state) => {
    state.stt = {
      isRecording: false,
      isTranscribing: false,
      lastTranscription: null
    };
  })
}); 