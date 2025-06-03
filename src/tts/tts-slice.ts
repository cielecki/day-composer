import { StateCreator } from 'zustand';
import type { PluginStore } from '../store/plugin-store';
import { TTSStreamingService } from '../services/TTSStreamingService';
import { getPluginSettings, TTSVoice, TTS_VOICES } from '../settings/LifeNavigatorSettings';
import { DEFAULT_VOICE_INSTRUCTIONS } from '../utils/mode/ln-mode-defaults';
import { getDefaultLNMode } from '../utils/mode/ln-mode-defaults';
import { Notice } from 'obsidian';
import { t } from '../i18n';
import OpenAI from 'openai';

// Cache interface for storing generated audio
interface TTSCache {
  [textHash: string]: {
    audioBlob: Blob;
    timestamp: number;
    voice: string;
    speed: number;
  };
}

// TTS slice interface - matching TextToSpeechContext property names
export interface TTSSlice {
  // State - matching original context property names
  tts: {
    isSpeaking: boolean;
    isGeneratingSpeech: boolean;
    isPaused: boolean;
    audioSrc: string | null;
  };
  
  // TTS Actions
  setTTSPlayingAudio: (playing: boolean) => void;
  setTTSGeneratingSpeech: (generating: boolean) => void;
  setTTSPaused: (paused: boolean) => void;
  setTTSAudioSrc: (src: string | null) => void;
  resetTTS: () => void;
  
  // Business Logic Actions - matching original context interface
  speakText: (text: string, signal: AbortSignal, bypassEnabledCheck?: boolean) => Promise<void>;
  stopAudio: () => void;
  pauseAudio: () => void;
  resumeAudio: () => void;
  clearCache: () => void;
}

// Type for StateCreator with immer middleware - updated to use PluginStore
type ImmerStateCreator<T> = StateCreator<
  PluginStore,
  [["zustand/immer", never]],
  [],
  T
>;

// Create TTS slice - now get() returns full PluginStore type
export const createTTSSlice: ImmerStateCreator<TTSSlice> = (set, get) => {
  // Internal refs for service management
  let streamingServiceRef: TTSStreamingService | null = null;
  let currentAudioElementRef: HTMLAudioElement | null = null;
  let currentAudioController: AbortController | null = null;
  let audioCacheRef: TTSCache = {};

  const getCurrentTTSSettings = () => {
    const state = get();
    const currentMode = state.modes.available[state.modes.activeId];
    const defaultMode = getDefaultLNMode();
    
    return {
      enabled: currentMode?.ln_voice_autoplay ?? defaultMode.ln_voice_autoplay,
      voice: currentMode?.ln_voice ?? defaultMode.ln_voice,
      instructions: currentMode?.ln_voice_instructions ?? defaultMode.ln_voice_instructions,
      speed: currentMode?.ln_voice_speed ?? defaultMode.ln_voice_speed,
    };
  };

  const initializeStreamingService = () => {
    const apiKey = getPluginSettings().getSecret('OPENAI_API_KEY');
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
          state.tts.isSpeaking = false;
          state.tts.isPaused = false;
        });
        resolve();
      };

      audioElement.onended = handlePlaybackEnd;
      
      audioElement.onplay = () => {
        set((state) => {
          state.tts.isSpeaking = true;
          state.tts.isGeneratingSpeech = false;
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
          state.tts.isSpeaking = false;
        });
        new Notice(t('errors.audio.playbackError', { error: err instanceof Error ? err.message : String(err) }));
        reject(err);
      });
    });
  };

  return {
    tts: {
      isSpeaking: false,
      isGeneratingSpeech: false,
      isPaused: false,
      audioSrc: null
    },
    
    // TTS actions
    setTTSPlayingAudio: (playing) => set((state) => {
      state.tts.isSpeaking = playing;
    }),
    
    setTTSGeneratingSpeech: (generating) => set((state) => {
      state.tts.isGeneratingSpeech = generating;
    }),
    
    setTTSPaused: (paused) => set((state) => {
      state.tts.isPaused = paused;
    }),
    
    setTTSAudioSrc: (src) => set((state) => {
      state.tts.audioSrc = src;
    }),
    
    resetTTS: () => set((state) => {
      state.tts = {
        isSpeaking: false,
        isGeneratingSpeech: false,
        isPaused: false,
        audioSrc: null
      };
    }),

    // Business Logic Implementation
    speakText: async (text: string, signal: AbortSignal, bypassEnabledCheck = false): Promise<void> => {
      const state = get();
      const ttsSettings = getCurrentTTSSettings();
      
      if (!bypassEnabledCheck && !ttsSettings.enabled) {
        return Promise.resolve();
      }

      const settings = getPluginSettings();
      state.stopAudio();

      // Create internal abort controller
      const internalController = new AbortController();
      currentAudioController = internalController;

      // Create combined signal with fallback for environments without AbortSignal.any()
      let combinedSignal: AbortSignal;
      
      if (typeof AbortSignal.any === 'function') {
        // Use native AbortSignal.any() when available (modern browsers)
        combinedSignal = AbortSignal.any([signal, internalController.signal]);
      } else {
        // Fallback implementation for older environments
        const combinedController = new AbortController();
        combinedSignal = combinedController.signal;
        
        // Listen to both signals and abort the combined one when either aborts
        const abortCombined = () => {
          if (!combinedController.signal.aborted) {
            combinedController.abort();
          }
        };
        
        if (signal.aborted || internalController.signal.aborted) {
          abortCombined();
        } else {
          signal.addEventListener('abort', abortCombined, { once: true });
          internalController.signal.addEventListener('abort', abortCombined, { once: true });
        }
      }

      // Generate cache key
      const textHash = generateTextHash(text, ttsSettings.voice || 'alloy', ttsSettings.speed || 1.0);
      
      // Check cache first
      const cachedAudio = getCachedAudio(textHash);
      if (cachedAudio) {
        console.log('Using cached audio for text');
        return playCachedAudio(cachedAudio, combinedSignal).finally(() => {
          if (currentAudioController === internalController) {
            currentAudioController = null;
          }
        });
      }

      // No cached audio found, generate new audio
      console.log('No cached audio found, generating new audio');
      
      try {
        set((state) => {
          state.tts.isGeneratingSpeech = true;
        });
                
        // Handle abort signal
        if (combinedSignal.aborted) {
          return;
        }
        
        // Verify we have a valid API key
        if (!settings.getSecret('OPENAI_API_KEY')) {
          console.error('No OpenAI API key available for TTS');
          new Notice(t('errors.tts.noApiKey'));
          return;
        }
        
        // Skip empty text
        if (!text || text.trim().length === 0) {
          console.log('Skipping empty text in speakText');
          return;
        }
        
        const maxLength = 4096;
        const textToConvert = text.length > maxLength ? text.substring(0, maxLength) : text;
        
        console.log('Creating OpenAI client and sending TTS request');
        
        let voice: TTSVoice = 'alloy';
        if (ttsSettings.voice) {
          if (!TTS_VOICES.includes(ttsSettings.voice as TTSVoice)) {
            new Notice(t('errors.tts.invalidVoice', { voice: ttsSettings.voice }));
          } else {
            voice = ttsSettings.voice as TTSVoice;
          }
        }

        // Generate audio using fetch API (similar to legacy TTS)
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.getSecret('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: textToConvert,
            voice: voice,
            speed: ttsSettings.speed || 1.0,
            response_format: 'mp3'
          }),
          signal: combinedSignal
        });

        if (!response.ok) {
          throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
        }

        // Check for abort again after API call
        if (combinedSignal.aborted) {
          return;
        }

        // Get the response as a blob and cache it
        const audioBlob = await response.blob();
        
        // Check for abort again after blob conversion
        if (combinedSignal.aborted) {
          return;
        }
        
        setCachedAudio(textHash, audioBlob, voice, ttsSettings.speed || 1.0);

        // Check for abort again before playing audio
        if (combinedSignal.aborted) {
          return;
        }

        // Play the audio
        await playCachedAudio(audioBlob, combinedSignal);
        
      } catch (error) {
        console.error('Error during TTS:', error);
        if (!combinedSignal.aborted) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error during TTS';
          new Notice(t('errors.tts.transcriptionFailed', { error: errorMessage }));
        }
        throw error;
      } finally {
        set((state) => {
          state.tts.isSpeaking = false;
          state.tts.isGeneratingSpeech = false;
        });
        
        if (currentAudioController === internalController) {
          currentAudioController = null;
        }
      }
    },

    stopAudio: () => {
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
        state.tts.isSpeaking = false;
        state.tts.isGeneratingSpeech = false;
        state.tts.isPaused = false;
      });
    },

    pauseAudio: () => {
      if (streamingServiceRef && streamingServiceRef.isCurrentlyPlaying()) {
        streamingServiceRef.pauseStreaming();
        set((state) => {
          state.tts.isPaused = true;
          state.tts.isSpeaking = false;
        });
      } else if (currentAudioElementRef && !currentAudioElementRef.paused) {
        currentAudioElementRef.pause();
        set((state) => {
          state.tts.isPaused = true;
          state.tts.isSpeaking = false;
        });
      }
    },

    resumeAudio: () => {
      const state = get();
      if (streamingServiceRef && state.tts.isPaused) {
        streamingServiceRef.resumeStreaming();
        set((state) => {
          state.tts.isPaused = false;
          state.tts.isSpeaking = true;
        });
      } else if (currentAudioElementRef && state.tts.isPaused) {
        currentAudioElementRef.play().then(() => {
          set((state) => {
            state.tts.isPaused = false;
            state.tts.isSpeaking = true;
          });
        }).catch(err => {
          console.error('Error resuming audio:', err);
          set((state) => {
            state.tts.isPaused = false;
          });
        });
      } else if (state.tts.isPaused && !currentAudioElementRef) {
        // Audio element is null (audio finished naturally), clear paused state
        console.log('Audio finished naturally, clearing paused state');
        set((state) => {
          state.tts.isPaused = false;
        });
      }
    },

    clearCache: () => {
      audioCacheRef = {};
    }
  };
}; 