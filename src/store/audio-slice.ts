import type { ImmerStateCreator } from './plugin-store';
import { TTSStreamingService } from './TTSStreamingService';
import { getDefaultLNMode } from 'src/utils/modes/ln-mode-defaults';
import { Notice } from 'obsidian';
import { t } from 'src/i18n';
import OpenAI from 'openai';
import { expandLinks } from 'src/utils/links/expand-links';

export type TTSVoice = "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "onyx" | "nova" | "sage" | "shimmer" | "verse";
export const TTS_VOICES: TTSVoice[] = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];
const MAX_AUDIO_PROMPT_LENGTH = 5000;

// Cache interface for storing generated audio
interface TTSCache {
  [textHash: string]: {
    audioBlob: Blob;
    timestamp: number;
    voice: string;
    speed: number;
  };
}

export interface AudioSlice {
  audio: {
    isSpeaking: boolean;
    isGeneratingSpeech: boolean;
    isSpeakingPaused: boolean;
    isRecording: boolean;
    isTranscribing: boolean;
    lastTranscription: string | null;
  };

  speakingStart: (text: string) => Promise<void>;
  speakingPause: () => void;
  speakingResume: () => void;
  speakingClearCache: () => void;

  recordingStart: () => Promise<void>;
  recordingToTranscribing: () => Promise<void>;
  
  audioStop: () => Promise<void>;
}

// Create TTS slice - now get() returns full PluginStore type
export const createAudioSlice: ImmerStateCreator<AudioSlice> = (set, get) => {
  
  // Internal refs for speaking management
  let streamingServiceRef: TTSStreamingService | null = null;
  let currentAudioElementRef: HTMLAudioElement | null = null;
  let currentAudioController: AbortController | null = null;
  let audioCacheRef: TTSCache = {};

  // Internal refs for recording management
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  
  const getCurrentTTSSettings = () => {
    const state = get();
    const currentMode = state.modes.available[state.modes.activeId];
    const defaultMode = getDefaultLNMode();
    
    return {
      voice: currentMode?.voice ?? defaultMode.voice,
      instructions: currentMode?.voice_instructions ?? defaultMode.voice_instructions,
      speed: currentMode?.voice_speed ?? defaultMode.voice_speed,
    };
  };

  const initializeStreamingService = () => {
    const apiKey = get().getSecret('OPENAI_API_KEY');
    const settings = getCurrentTTSSettings();
    
    if (apiKey && !streamingServiceRef) {
      streamingServiceRef = new TTSStreamingService(
        apiKey, 
        (settings.voice as TTSVoice) || 'alloy', 
        settings.speed || 1.0
      );
    }
    return streamingServiceRef;
  };

  const generateTextHash = (text: string, voice: string, speed: number): string => {
    const str = `${text}-${voice}-${speed}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  };

  const getCachedAudio = (textHash: string): Blob | null => {
    const cached = audioCacheRef[textHash];
    if (cached) {
      // Check if cache is not too old (1 hour)
      const isExpired = Date.now() - cached.timestamp > 60 * 60 * 1000;
      if (isExpired) {
        delete audioCacheRef[textHash];
        return null;
      }
      return cached.audioBlob;
    }
    return null;
  };

  const setCachedAudio = (textHash: string, audioBlob: Blob, voice: string, speed: number) => {
    audioCacheRef[textHash] = {
      audioBlob,
      timestamp: Date.now(),
      voice,
      speed
    };
    
    // Clean up old cache entries (keep only 10 most recent)
    const entries = Object.entries(audioCacheRef);
    if (entries.length > 10) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      audioCacheRef = Object.fromEntries(entries.slice(0, 10));
    }
  };

  const playCachedAudio = (audioBlob: Blob, signal: AbortSignal): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const audioElement = new Audio();
      currentAudioElementRef = audioElement;
      
      if (signal.aborted) {
        resolve();
        return;
      }

      // Handle abort signal
      signal.addEventListener('abort', () => {
        audioElement.pause();
        resolve();
      });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Set up event handlers
      const handlePlaybackEnd = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioElementRef = null;
        
        if (signal.aborted) {
          resolve();
          return;
        }
        
        set((state) => {
          state.audio.isSpeaking = false;
          state.audio.isSpeakingPaused = false;
        });
        resolve();
      };

      audioElement.onended = handlePlaybackEnd;
      
      audioElement.onplay = () => {
        set((state) => {
          state.audio.isSpeaking = true;
          state.audio.isGeneratingSpeech = false;
        });
      };
      
      audioElement.onerror = (e) => {
        console.error('Error playing cached audio:', e);
        URL.revokeObjectURL(audioUrl);
        currentAudioElementRef = null;
        
        const errorMessage = audioElement?.error 
          ? `Audio error: ${audioElement.error.code} - ${audioElement.error.message}`
          : 'Unknown audio playback error';
        console.error(errorMessage);
        
        reject(new Error(errorMessage));
      };
      
      // Set the source and play
      audioElement.src = audioUrl;
      
      audioElement.play().catch(err => {
        console.error('Error playing cached audio:', err);
        set((state) => {
          state.audio.isSpeaking = false;
        });
        new Notice(t('errors.audio.playbackError', { error: err instanceof Error ? err.message : String(err) }));
        reject(err);
      });
    });
  };

  const transcribeAudio = async (recorder: MediaRecorder): Promise<void> => {
    const chunks = audioChunks;
    if (!chunks.length) throw new Error('No audio chunks to transcribe');
    
    set((state) => {
      state.audio.isTranscribing = true;
    });
    
    // Create a new abort controller for transcription
    currentAudioController = new AbortController();
    const signal = currentAudioController.signal;
    
    try {
      const store = get();
      const openaiApiKey = store.getSecret('OPENAI_API_KEY');
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
      
      // Get Obsidian's language setting from localStorage
      const obsidianLang = window.localStorage.getItem('language') || 'en';
      let targetLanguageForApi = obsidianLang;
      let promptToUse = store.settings.speechToTextPrompt;

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

      console.debug(`Transcribing audio. Language for API: ${targetLanguageForApi}. Using prompt:`, trimmedPrompt);
      
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'gpt-4o-transcribe',
        prompt: trimmedPrompt,
        language: targetLanguageForApi,
      }, { signal });

      if (signal.aborted) {
        return;
      }

      console.debug('Transcribed text:', transcription.text);
      set((state) => {
        state.audio.lastTranscription = transcription.text;
      });
    } catch (error) {
      
      set((state) => {
        state.audio.lastTranscription = null;
      });
      
      // If not aborted, show error notice
      if (!signal.aborted) {
        console.error('Error during transcription:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during transcription';
        new Notice(t('errors.audio.transcriptionFailed', { error: errorMessage }));
        throw error;
      }

    } finally {
      set((state) => {
        state.audio.isTranscribing = false;
      });
      currentAudioController = null;
    }
  };
  
  return {
    audio: {
      isSpeaking: false,
      isGeneratingSpeech: false,
      isSpeakingPaused: false,
      isRecording: false,
      isTranscribing: false,
      lastTranscription: null
    },
    
    recordingStart: async (): Promise<void> => {
      currentAudioController = new AbortController();
      const signal = currentAudioController.signal;
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
        console.debug('Using audio format:', recorder.mimeType);

        recorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) {
            audioChunks = [...audioChunks, event.data];
          }
        });
        
        signal.addEventListener('abort', () => recorder.stop());
        
        recorder.addEventListener('stop', async () => {
          set((state) => {
            state.audio.isRecording = false;
          });
          
          if (!signal.aborted) {
            await transcribeAudio(recorder);
          }
          stream.getTracks().forEach(track => track.stop());
        });
        
        recorder.start();
        mediaRecorder = recorder;
        
        set((state) => {
          state.audio.isRecording = true;
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        let errorMessage = t('errors.audio.microphone.general');
        if (error instanceof DOMException) {
          if (error.name === 'NotAllowedError') errorMessage = t('errors.audio.microphone.accessDenied');
          else if (error.name === 'NotFoundError') errorMessage = t('errors.audio.microphone.notFound');
          else if (error.name === 'NotReadableError') errorMessage = t('errors.audio.microphone.inUse');
        }
        new Notice(errorMessage);
        set((state) => {
          state.audio.isRecording = false;
        });
      }
    },

    recordingToTranscribing: async (): Promise<void> => {
      console.debug("Stopping speech-to-text operations");
      
      const state = get();
      if (mediaRecorder && state.audio.isRecording) {
        mediaRecorder.stop();
      }
    },

    audioStop: async () => {
      if (streamingServiceRef) {
        streamingServiceRef.stopStreaming();
      }
      
      if (currentAudioController) {
        currentAudioController.abort();
        currentAudioController = null;
      }
      
      if (currentAudioElementRef) {
        currentAudioElementRef.pause();
        currentAudioElementRef = null;
      }
  
      set((state) => {
        state.audio.lastTranscription = null;
        state.audio.isSpeaking = false;
        state.audio.isGeneratingSpeech = false;
        state.audio.isSpeakingPaused = false;
      });
    },
    
    // Business Logic Implementation
    speakingStart: async (text: string): Promise<void> => {
      if (get().audio.isRecording || get().audio.isTranscribing) {
        return;
      }

      // Stop any existing audio FIRST, before creating new controller
      await get().audioStop();
      
      // Now create a new controller for this audio generation
      currentAudioController = new AbortController();
      const signal = currentAudioController.signal;
      const ttsSettings = getCurrentTTSSettings();

      const store = get();

      // Generate cache key
      const textHash = generateTextHash(text, ttsSettings.voice || 'alloy', ttsSettings.speed || 1.0);
      
      // Check cache first
      const cachedAudio = getCachedAudio(textHash);
      if (cachedAudio) {
        console.debug('Using cached audio for text');
        return playCachedAudio(cachedAudio, signal);
      }

      // No cached audio found, generate new audio
      console.debug('No cached audio found, generating new audio');
      
      try {
        set((state) => {
          state.audio.isGeneratingSpeech = true;
        });
                
        // Handle abort signal
        if (signal.aborted) {
          return;
        }
        
        // Verify we have a valid API key
        const apiKey = store.getSecret('OPENAI_API_KEY');
        if (!apiKey) {
          console.error('No OpenAI API key available for TTS');
          new Notice(t('errors.audio.noApiKey'));
          return;
        }
        
        // Skip empty text
        if (!text || text.trim().length === 0) {
          console.debug('Skipping empty text in speakText');
          return;
        }
        
        const maxLength = 4096;
        const textToConvert = text.length > maxLength ? text.substring(0, maxLength) : text;
        
        console.debug('Creating OpenAI client and sending TTS request');
        
        let voice: TTSVoice = 'alloy';
        if (ttsSettings.voice) {
          if (!TTS_VOICES.includes(ttsSettings.voice as TTSVoice)) {
            new Notice(t('errors.audio.invalidVoice', { voice: ttsSettings.voice }));
          } else {
            voice = ttsSettings.voice as TTSVoice;
          }
        }

        // Generate audio using fetch API (similar to legacy TTS)
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: textToConvert,
            voice: voice,
            speed: ttsSettings.speed || 1.0,
            response_format: 'mp3'
          }),
          signal: signal
        });

        if (!response.ok) {
          throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
        }

        // Check for abort again after API call
        if (signal.aborted) {
          return;
        }

        // Get the response as a blob and cache it
        const audioBlob = await response.blob();
        
        // Check for abort again after blob conversion
        if (signal.aborted) {
          return;
        }
        
        setCachedAudio(textHash, audioBlob, voice, ttsSettings.speed || 1.0);

        // Check for abort again before playing audio
        if (signal.aborted) {
          return;
        }

        // Play the audio
        await playCachedAudio(audioBlob, signal);
        
      } catch (error) {
        console.error('Error during TTS:', error);
        if (!signal.aborted) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error during TTS';
          new Notice(t('errors.audio.transcriptionFailed', { error: errorMessage }));
        }
        throw error;
      } finally {
        set((state) => {
          state.audio.isSpeaking = false;
          state.audio.isGeneratingSpeech = false;
        });
      }
    },

    speakingPause: () => {
      if (streamingServiceRef && streamingServiceRef.isCurrentlyPlaying()) {
        streamingServiceRef.pauseStreaming();
        set((state) => {
          state.audio.isSpeakingPaused = true;
          state.audio.isSpeaking = false;
        });
      } else if (currentAudioElementRef && !currentAudioElementRef.paused) {
        currentAudioElementRef.pause();
        set((state) => {
          state.audio.isSpeakingPaused = true;
          state.audio.isSpeaking = false;
        });
      }
    },

    speakingResume: () => {
      const state = get();
      if (streamingServiceRef && state.audio.isSpeakingPaused) {
        streamingServiceRef.resumeStreaming();
        set((state) => {
          state.audio.isSpeakingPaused = false;
          state.audio.isSpeaking = true;
        });
      } else if (currentAudioElementRef && state.audio.isSpeakingPaused) {
        currentAudioElementRef.play().then(() => {
          set((state) => {
            state.audio.isSpeakingPaused = false;
            state.audio.isSpeaking = true;
          });
        }).catch(err => {
          console.error('Error resuming audio:', err);
          set((state) => {
            state.audio.isSpeakingPaused = false;
          });
        });
      } else if (state.audio.isSpeakingPaused && !currentAudioElementRef) {
        // Audio element is null (audio finished naturally), clear paused state
        console.debug('Audio finished naturally, clearing paused state');
        set((state) => {
          state.audio.isSpeakingPaused = false;
        });
      }
    },

    speakingClearCache: () => {
      audioCacheRef = {};
    }
  };
}; 