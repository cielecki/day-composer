import { StateCreator } from 'zustand';
import type { PluginStore } from '../store/plugin-store';
import { getPluginSettings } from '../settings/LifeNavigatorSettings';
import { Notice, moment } from 'obsidian';
import { t } from '../i18n';
import OpenAI from 'openai';
import { expandLinks } from '../utils/links/expand-links';

const MAX_AUDIO_PROMPT_LENGTH = 5000;

export interface STTSlice {
  stt: {
    isRecording: boolean;
    isTranscribing: boolean;
    lastTranscription: string | null;
  };

  startRecording: (signal: AbortSignal) => Promise<void>;
  finalizeRecording: () => Promise<void>;
  cancelTranscription: () => void;
}

type ImmerStateCreator<T> = StateCreator<
  PluginStore,
  [["zustand/immer", never]],
  [],
  T
>;

export const createSTTSlice: ImmerStateCreator<STTSlice> = (set, get) => {  
  // Internal refs for recording management
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let transcriptionAbortController: AbortController | null = null;

  const transcribeAudio = async (recorder: MediaRecorder, signal: AbortSignal): Promise<void> => {
    const chunks = audioChunks;
    if (!chunks.length) throw new Error('No audio chunks to transcribe');
    
    set((state) => {
      state.stt.isTranscribing = true;
    });
    
    // Create a new abort controller for transcription
    transcriptionAbortController = new AbortController();
    
    try {
      const pluginSettings = getPluginSettings();
      const openaiApiKey = pluginSettings.getSecret('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OpenAI API key is not configured');
      }
      
      const mimeType = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(chunks, { type: mimeType });
      
      if (audioBlob.size < 1000) {
        throw new Error('Recording too short or no audio detected');
      }
      
      const openai = new OpenAI({
        apiKey: openaiApiKey,
        dangerouslyAllowBrowser: true,
      });
      
      let fileExtension = 'webm';
      if (mimeType.includes('mp3')) fileExtension = 'mp3';
      else if (mimeType.includes('wav')) fileExtension = 'wav';
      else if (mimeType.includes('mp4')) fileExtension = 'mp4';
      else if (mimeType.includes('m4a')) fileExtension = 'm4a';
      
      const file = new File([audioBlob], `recording.${fileExtension}`, { type: mimeType });
      
      const currentLang = moment.locale(); // e.g., 'en', 'pl'
      let targetLanguageForApi = currentLang;
      let promptToUse = pluginSettings.speechToTextPrompt;

      // Fallback logic for prompt
      if (!promptToUse) {
        promptToUse = t('settings.prompts.defaultPrompt');
      }
      
      // Ensure targetLanguageForApi is a 2-letter code if possible
      if (targetLanguageForApi.includes('-')) {
        targetLanguageForApi = targetLanguageForApi.split('-')[0];
      }

      const expandedPrompt = await expandLinks(window.app, promptToUse);
      const trimmedPrompt = expandedPrompt.length > MAX_AUDIO_PROMPT_LENGTH 
        ? expandedPrompt.substring(0, Math.floor(MAX_AUDIO_PROMPT_LENGTH / 2)) + "..." + expandedPrompt.substring(expandedPrompt.length - Math.floor(MAX_AUDIO_PROMPT_LENGTH / 2))
        : expandedPrompt;

      console.log(`Transcribing audio. Language for API: ${targetLanguageForApi}. Using prompt:`, trimmedPrompt);
      
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'gpt-4o-transcribe',
        prompt: trimmedPrompt,
        language: targetLanguageForApi,
      }, { signal: transcriptionAbortController.signal });

      console.log('Transcribed text:', transcription.text);
      set((state) => {
        state.stt.lastTranscription = transcription.text;
      });
    } catch (error) {
      console.error('Error during transcription:', error);

      set((state) => {
        state.stt.lastTranscription = null;
      });
      
      // If not aborted, show error notice
      if (!transcriptionAbortController?.signal.aborted) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during transcription';
        new Notice(t('errors.tts.transcriptionFailed', { error: errorMessage }));
      }

      throw error;
    } finally {
      set((state) => {
        state.stt.isTranscribing = false;
      });
      transcriptionAbortController = null;
    }
  };

  return {
    stt: {
      isRecording: false,
      isTranscribing: false,
      lastTranscription: null
    },
    
    // Business Logic Implementation
    startRecording: async (signal: AbortSignal): Promise<void> => {
      try {
        audioChunks = [];
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
            sampleRate: 16000
          } 
        });
        
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp3')) {
          options = { mimeType: 'audio/mp3' };
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          options = { mimeType: 'audio/wav' };
        } else if (MediaRecorder.isTypeSupported('audio/m4a')) {
          options = { mimeType: 'audio/m4a' };
        }
        
        const recorder = new MediaRecorder(stream, options);
        console.log('Using audio format:', recorder.mimeType);

        recorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) {
            audioChunks = [...audioChunks, event.data];
          }
        });
        
        signal.addEventListener('abort', () => recorder.stop());
        
        recorder.addEventListener('stop', async () => {
          set((state) => {
            state.stt.isRecording = false;
          });
          
          if (!signal.aborted) {
            await transcribeAudio(recorder, signal);
          }
          stream.getTracks().forEach(track => track.stop());
        });
        
        recorder.start();
        mediaRecorder = recorder;
        
        set((state) => {
          state.stt.isRecording = true;
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        let errorMessage = t('errors.tts.microphone.general');
        if (error instanceof DOMException) {
          if (error.name === 'NotAllowedError') errorMessage = t('errors.tts.microphone.accessDenied');
          else if (error.name === 'NotFoundError') errorMessage = t('errors.tts.microphone.notFound');
          else if (error.name === 'NotReadableError') errorMessage = t('errors.tts.microphone.inUse');
        }
        new Notice(errorMessage);
        set((state) => {
          state.stt.isRecording = false;
        });
      }
    },

    finalizeRecording: async (): Promise<void> => {
      console.log("Stopping speech-to-text operations");
      
      const state = get();
      if (mediaRecorder && state.stt.isRecording) {
        mediaRecorder.stop();
      }
    },

    cancelTranscription: () => {
      console.log("Cancelling transcription");
      if (transcriptionAbortController) {
        transcriptionAbortController.abort();
        transcriptionAbortController = null;
      }
      set((state) => {
        state.stt.lastTranscription = null;
      });
    }
  };
}; 