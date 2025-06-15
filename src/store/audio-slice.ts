import type { ImmerStateCreator } from './plugin-store';
import { TTSStreamingService } from './TTSStreamingService';
import { getDefaultLNMode } from 'src/utils/modes/ln-mode-defaults';
import { Notice } from 'obsidian';
import { t } from 'src/i18n';
import OpenAI from 'openai';
import { DEFAULT_MODE_ID } from '../utils/modes/ln-mode-defaults';
import { ElevenLabsService } from '../services/ElevenLabsService';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';

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
    provider: 'openai' | 'elevenlabs';
  };
}

// Whisper transcription quality assessment interface
interface TranscriptionQuality {
  confidence: number;
  isHighQuality: boolean;
  retryRecommended: boolean;
}

// Interface for enhanced transcription result
interface EnhancedTranscriptionResult {
  text: string;
  quality: TranscriptionQuality;
  segments?: any[];
}

export interface AudioSlice {
  audio: {
    isSpeaking: boolean;
    isGeneratingSpeech: boolean;
    isSpeakingPaused: boolean;
    // Recording coordination (global)
    currentRecordingWindowId: string | null;
  };

  speakingStart: (text: string, modeId?: string) => Promise<void>;
  speakingPause: () => void;
  speakingResume: () => void;
  speakingClearCache: () => void;

  // Recording coordination
  recordingStart: (windowId: string) => Promise<boolean>;
  recordingStop: (windowId: string) => Promise<void>;
  recordingToTranscribing: (windowId: string, chatId: string) => Promise<void>;
  
  // Global audio stop (TTS only)
  audioStop: () => Promise<void>;
  
  // Transcription stop
  transcriptionStop: () => Promise<void>;
  
  // Recording state queries
  isRecordingInWindow: (windowId: string) => boolean;
  canRecordInWindow: (windowId: string) => boolean;
}

// Create TTS slice - now get() returns full PluginStore type
export const createAudioSlice: ImmerStateCreator<AudioSlice> = (set, get) => {
  
  // Internal refs for speaking management
  let streamingServiceRef: TTSStreamingService | null = null;
  let currentAudioElementRef: HTMLAudioElement | null = null;
  let currentAudioController: AbortController | null = null;
  let audioCacheRef: TTSCache = {};

  // Internal refs for recording management
  let audioChunks: Blob[] = [];
  let mediaRecorder: MediaRecorder | null = null;
  let currentTranscriptionController: AbortController | null = null;
  
  // ElevenLabs service instance
  let elevenLabsServiceRef: ElevenLabsService | null = null;

  // Helper functions for provider detection
  const getElevenLabsApiKey = (): string | null => {
    const apiKey = get().getSecret('ELEVENLABS_API_KEY');
    return apiKey && apiKey.trim().length > 0 ? apiKey : null;
  };

  const getOpenAIApiKey = (): string | null => {
    const apiKey = get().getSecret('OPENAI_API_KEY');
    return apiKey && apiKey.trim().length > 0 ? apiKey : null;
  };

  const isElevenLabsAvailable = (): boolean => {
    return getElevenLabsApiKey() !== null;
  };

  const initializeElevenLabsService = (): ElevenLabsService | null => {
    const apiKey = getElevenLabsApiKey();
    if (apiKey) {
      if (!elevenLabsServiceRef) {
        console.debug('Initializing ElevenLabs service with API key');
        elevenLabsServiceRef = new ElevenLabsService(apiKey);
      }
      return elevenLabsServiceRef;
    } else {
      console.warn('ElevenLabs API key not found');
      return null;
    }
  };


  const initializeStreamingService = (modeId?: string) => {
    const apiKey = get().getSecret('OPENAI_API_KEY');
    const state = get();
    const effectiveModeId = modeId || DEFAULT_MODE_ID;
    const currentMode = state.modes.available[effectiveModeId];
    const defaultMode = getDefaultLNMode();
    
    const voice = ((currentMode?.voice ?? defaultMode.voice) as TTSVoice) || 'alloy';
    const speed = (currentMode?.voice_speed ?? defaultMode.voice_speed) || 1.0;
    
    if (apiKey && !streamingServiceRef) {
      streamingServiceRef = new TTSStreamingService(apiKey, voice, speed);
    }
    return streamingServiceRef;
  };

  const generateTextHash = (text: string, voice: string, speed: number, provider: 'openai' | 'elevenlabs' = 'openai'): string => {
    const str = `${provider}-${text}-${voice}-${speed}`;
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

  const setCachedAudio = (textHash: string, audioBlob: Blob, voice: string, speed: number, provider: 'openai' | 'elevenlabs' = 'openai') => {
    audioCacheRef[textHash] = {
      audioBlob,
      timestamp: Date.now(),
      voice,
      speed,
      provider
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
        const errorMessage = err instanceof Error ? err.message : String(err);
        new Notice(t('errors.audio.playbackError', { error: errorMessage }));
        reject(err);
      });
    });
  };

  // Utility functions for Whisper prompting improvements
  const generateContextualPrompt = async (chatId: string, currentModeId: string): Promise<string> => {
    const store = get();
    const chatState = store.getChatState(chatId);
    const currentMode = store.modes.available[currentModeId];
    
    // Build contextual prompt parts
    const promptParts: string[] = [];
    
    // 1. Add user-configured base prompt if available
    const userPrompt = store.settings.speechToTextPrompt;
    if (userPrompt && userPrompt.trim()) {
      promptParts.push(userPrompt.trim());
    }
    
    // 2. Generate and add system prompt from current mode (condensed)
    if (currentMode) {
      try {
        const systemPromptParts = await store.getSystemPrompt(currentModeId);
        if (systemPromptParts.staticSection) {
          // Extract key context from system prompt (first 300 chars)
          const systemContext = systemPromptParts.staticSection
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 300);
          if (systemContext) {
            promptParts.push(`Mode context: ${systemContext}`);
          }
        }
      } catch (error) {
        console.debug('Could not get system prompt for context:', error);
      }
    }
    
    // 3. Add currently open file and selection context
    try {
      const plugin = LifeNavigatorPlugin.getInstance();
      if (plugin?.app) {
        // Get current file context
        const { handleCurrentlyOpenFileLink, handleCurrentlySelectedTextLink } = await import('src/utils/links/special-link-handlers');
        
        const currentFileContent = await handleCurrentlyOpenFileLink(plugin.app);
        if (currentFileContent && !currentFileContent.includes('[No file currently open]')) {
          // Extract filename and brief content
          const fileMatch = currentFileContent.match(/file="([^"]+)"/);
          const fileName = fileMatch ? fileMatch[1].split('/').pop() : 'current file';
          promptParts.push(`Working on: ${fileName}`);
        }
        
        const selectedText = handleCurrentlySelectedTextLink(plugin.app);
                 if (selectedText && selectedText.includes('status="selected"')) {
           // Extract selected text content (first 200 chars)
           const textMatch = selectedText.match(/<[^>]+status="selected"[^>]*>[\s\S]*?<\/[^>]+>/);
           if (textMatch && textMatch[0]) {
             // Extract content between tags
             const contentMatch = textMatch[0].match(/>([\s\S]*?)</);
             if (contentMatch && contentMatch[1]) {
               const selection = contentMatch[1].trim().substring(0, 200);
               if (selection) {
                 promptParts.push(`Selected: ${selection}`);
               }
             }
           }
         }
      }
    } catch (error) {
      console.debug('Could not get current file context:', error);
    }
    
    // 4. Add recent conversation context (last 3 messages for continuity)
    if (chatState?.chat.storedConversation.messages) {
      const recentMessages = chatState.chat.storedConversation.messages.slice(-3);
      const recentContext = recentMessages
        .map(msg => {
          if (typeof msg.content === 'string') {
            return msg.content;
          } else if (Array.isArray(msg.content)) {
            return msg.content
              .filter(block => typeof block === 'object' && block.type === 'text')
              .map(block => (block as any).text)
              .join(' ');
          }
          return '';
        })
        .filter(text => text.trim())
        .join(' ')
        .substring(0, 400); // Increased context length
      
      if (recentContext) {
        promptParts.push(`Recent discussion: ${recentContext}`);
      }
    }
    
    // Join all parts and limit length
    const fullPrompt = promptParts.join('. ');
    return fullPrompt.length > MAX_AUDIO_PROMPT_LENGTH 
      ? fullPrompt.substring(0, MAX_AUDIO_PROMPT_LENGTH - 3) + '...'
      : fullPrompt;
  };

  const assessTranscriptionQuality = (result: any): TranscriptionQuality => {
    // Default quality for simple text responses
    if (typeof result === 'string' || !result.segments) {
      return {
        confidence: 0.8, // Assume reasonable quality for simple responses
        isHighQuality: true,
        retryRecommended: false
      };
    }
    
    // Analyze verbose_json response for quality metrics
    const segments = result.segments || [];
    if (segments.length === 0) {
      return {
        confidence: 0.0,
        isHighQuality: false,
        retryRecommended: true
      };
    }
    
    // Calculate average confidence from segments
    const avgLogProb = segments.reduce((sum: number, seg: any) => sum + (seg.avg_logprob || -1.0), 0) / segments.length;
    const avgNoSpeechProb = segments.reduce((sum: number, seg: any) => sum + (seg.no_speech_prob || 0.5), 0) / segments.length;
    
    // Convert log probability to confidence score (rough approximation)
    const confidence = Math.max(0, Math.min(1, (avgLogProb + 1.0) * 0.8));
    
    // Quality thresholds based on research findings
    const isHighQuality = avgLogProb > -0.5 && avgNoSpeechProb < 0.3 && confidence > 0.6;
    const retryRecommended = avgLogProb < -1.0 || avgNoSpeechProb > 0.6 || confidence < 0.4;
    
    return {
      confidence,
      isHighQuality,
      retryRecommended
    };
  };

  const performEnhancedTranscription = async (
    file: File,
    targetLanguageForApi: string,
    chatId: string,
    currentModeId: string,
    signal: AbortSignal,
    maxRetries: number = 2
  ): Promise<EnhancedTranscriptionResult> => {
    const openaiApiKey = getOpenAIApiKey();
    if (!openaiApiKey) {
      throw new Error('No API key available for transcription');
    }
    
    const openai = new OpenAI({
      apiKey: openaiApiKey,
      dangerouslyAllowBrowser: true,
    });
    
    let lastError: Error | null = null;
    let bestResult: EnhancedTranscriptionResult | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal.aborted) {
        throw new Error('Transcription aborted');
      }
      
      try {
        // Generate contextual prompt for this attempt
        const contextualPrompt = await generateContextualPrompt(chatId, currentModeId);
        
        console.debug(`Whisper API attempt ${attempt + 1}/${maxRetries + 1}:`, {
          prompt: contextualPrompt.substring(0, 100) + '...',
          language: targetLanguageForApi,
          fileSize: file.size
        });
        
        // Use verbose_json for quality assessment on first attempt, fallback to json for retries
        const responseFormat = attempt === 0 ? 'verbose_json' : 'json';
        
        const transcription = await openai.audio.transcriptions.create({
          file: file,
          model: 'whisper-1',
          prompt: contextualPrompt,
          language: targetLanguageForApi,
          temperature: 0.0, // Deterministic results
          response_format: responseFormat,
        }, { signal });

        if (signal.aborted) {
          throw new Error('Transcription aborted');
        }

        // Process response based on format
        let result: EnhancedTranscriptionResult;
        if (responseFormat === 'verbose_json' && typeof transcription === 'object' && 'segments' in transcription) {
          result = {
            text: (transcription as any).text,
            quality: assessTranscriptionQuality(transcription),
            segments: (transcription as any).segments
          };
        } else {
          result = {
            text: typeof transcription === 'string' ? transcription : (transcription as any).text,
            quality: assessTranscriptionQuality(transcription),
          };
        }
        
        console.debug(`Whisper transcription attempt ${attempt + 1} result:`, {
          text: result.text.substring(0, 100) + '...',
          confidence: result.quality.confidence,
          isHighQuality: result.quality.isHighQuality
        });
        
        // If this is a high-quality result, return immediately
        if (result.quality.isHighQuality || attempt === maxRetries) {
          return result;
        }
        
        // Store best result so far
        if (!bestResult || result.quality.confidence > bestResult.quality.confidence) {
          bestResult = result;
        }
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`Whisper transcription attempt ${attempt + 1} failed:`, error);
        
        // If this is the last attempt, break out of the loop
        if (attempt === maxRetries) {
          break;
        }
        
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Return best result if we have one, otherwise throw the last error
    if (bestResult) {
      console.debug('Returning best transcription result after retries:', {
        confidence: bestResult.quality.confidence,
        text: bestResult.text.substring(0, 100) + '...'
      });
      return bestResult;
    }
    
    throw lastError || new Error('All transcription attempts failed');
  };

  const transcribeAudio = async (chatId: string, recorder: MediaRecorder): Promise<void> => {
    const chunks = audioChunks;
    if (!chunks.length) throw new Error('No audio chunks to transcribe');
    
    // Generate unique transcription ID
    const transcriptionId = `transcription-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Set transcription state on the specific chat
    get().setIsTranscribing(chatId, true);
    get().setTranscriptionId(chatId, transcriptionId);
    
    // Create a new abort controller for transcription
    currentTranscriptionController = new AbortController();
    const signal = currentTranscriptionController.signal;
    
    try {
      const store = get();
      const mimeType = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(chunks, { type: mimeType });
      
      if (audioBlob.size < 1000) {
        throw new Error('Recording too short or no audio detected');
      }
      
      // Get Obsidian's language setting from localStorage
      const obsidianLang = window.localStorage.getItem('language') || 'en';
      let targetLanguageForApi = obsidianLang;
      
      // Ensure targetLanguageForApi is a 2-letter code if possible
      if (targetLanguageForApi.includes('-')) {
        targetLanguageForApi = targetLanguageForApi.split('-')[0];
      }

      // Get current chat's active mode for context
      const chatState = store.getChatState(chatId);
      const currentModeId = chatState?.chat.storedConversation.modeId || DEFAULT_MODE_ID;

      let transcribedText = '';

      // Try ElevenLabs first if available
      if (isElevenLabsAvailable()) {
        try {
          console.debug('Using ElevenLabs for speech-to-text transcription');
          const elevenLabsService = initializeElevenLabsService();
          if (elevenLabsService) {
            const result = await elevenLabsService.speechToText(audioBlob, {
              language: targetLanguageForApi,
              diarize: false,
              audio_events: false
            });
            
            if (signal.aborted) {
              return;
            }
            
            transcribedText = result.text;
            console.debug('ElevenLabs transcribed text:', transcribedText);
          }
        } catch (elevenLabsError) {
          console.warn('ElevenLabs transcription failed, falling back to OpenAI:', elevenLabsError);
          // Continue to OpenAI fallback
        }
      }

      // Enhanced OpenAI Whisper transcription with contextual prompting
      if (!transcribedText) {
        console.debug('Using enhanced OpenAI Whisper transcription with contextual prompting');
        
        let fileExtension = 'webm';
        if (mimeType.includes('mp3')) fileExtension = 'mp3';
        else if (mimeType.includes('wav')) fileExtension = 'wav';
        else if (mimeType.includes('mp4')) fileExtension = 'mp4';
        else if (mimeType.includes('m4a')) fileExtension = 'm4a';
        
        const file = new File([audioBlob], `recording.${fileExtension}`, { type: mimeType });

        try {
          const enhancedResult = await performEnhancedTranscription(
            file,
            targetLanguageForApi,
            chatId,
            currentModeId,
            signal
          );
          
          transcribedText = enhancedResult.text;
          
          console.debug('Enhanced Whisper transcription completed:', {
            text: transcribedText.substring(0, 100) + '...',
            confidence: enhancedResult.quality.confidence,
            quality: enhancedResult.quality.isHighQuality ? 'HIGH' : 'MEDIUM/LOW'
          });
          
        } catch (enhancedError) {
          console.error('Enhanced transcription failed:', enhancedError);
          throw enhancedError;
        }
      }

      get().setLastTranscription(chatId, transcribedText);
    } catch (error) {
      
      get().setLastTranscription(chatId, null);
      
      // If not aborted, show error notice
      if (!signal.aborted) {
        console.error('Error during transcription:', error);
        new Notice(t('errors.audio.transcriptionFailed'));
        throw error;
      }

    } finally {
      get().setIsTranscribing(chatId, false);
      get().setTranscriptionId(chatId, undefined);
      currentTranscriptionController = null;
    }
  };
  
  return {
    audio: {
      isSpeaking: false,
      isGeneratingSpeech: false,
      isSpeakingPaused: false,
      currentRecordingWindowId: null
    },
    
    recordingStart: async (windowId: string): Promise<boolean> => {
      // Check if another window is already recording
      const currentState = get();
      if (currentState.audio.currentRecordingWindowId && currentState.audio.currentRecordingWindowId !== windowId) {
        console.debug(`Recording blocked: window ${currentState.audio.currentRecordingWindowId} is already recording`);
        return false;
      }

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
            state.audio.currentRecordingWindowId = null;
          });
          
          stream.getTracks().forEach(track => track.stop());
        });
        
        recorder.start();
        mediaRecorder = recorder;
        
        // Reserve recording for this window
        set((state) => {
          state.audio.currentRecordingWindowId = windowId;
        });
        
        return true;
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
          state.audio.currentRecordingWindowId = null;
        });
        
        return false;
      }
    },

    recordingStop: async (windowId: string): Promise<void> => {
      const currentState = get();
      if (currentState.audio.currentRecordingWindowId !== windowId) {
        console.debug(`Recording stop ignored: window ${windowId} is not the recording window`);
        return;
      }

      if (mediaRecorder) {
        mediaRecorder.stop();
      }
      
      if (currentAudioController) {
        currentAudioController.abort();
        currentAudioController = null;
      }
    },

    recordingToTranscribing: async (windowId: string, chatId: string): Promise<void> => {
      console.debug("Stopping speech-to-text operations and starting transcription");
      
      const currentState = get();
      if (currentState.audio.currentRecordingWindowId !== windowId) {
        console.debug(`Recording stop ignored: window ${windowId} is not the recording window`);
        return;
      }
      
      if (mediaRecorder) {
        // Set transcription state immediately to prevent UI flash
        get().setIsTranscribing(chatId, true);
        
        // Stop recording and let the transcription happen in the background
        const recorder = mediaRecorder;
        mediaRecorder.stop();
        
        // Wait for MediaRecorder to finish collecting audio chunks before transcribing
        setTimeout(() => {
          transcribeAudio(chatId, recorder);
        }, 100);
      }
    },

    isRecordingInWindow: (windowId: string): boolean => {
      const currentState = get();
      return currentState.audio.currentRecordingWindowId === windowId;
    },

    canRecordInWindow: (windowId: string): boolean => {
      const currentState = get();
      return currentState.audio.currentRecordingWindowId === null || 
             currentState.audio.currentRecordingWindowId === windowId;
    },

    audioStop: async () => {
      if (streamingServiceRef) {
        streamingServiceRef.stopStreaming();
      }
      
      // Only stop TTS operations, not transcription
      if (currentAudioController) {
        currentAudioController.abort();
        currentAudioController = null;
      }
      
      if (currentAudioElementRef) {
        currentAudioElementRef.pause();
        currentAudioElementRef = null;
      }
  
      set((state) => {
        state.audio.isSpeaking = false;
        state.audio.isGeneratingSpeech = false;
        state.audio.isSpeakingPaused = false;
      });
    },

    transcriptionStop: async () => {
      // Stop transcription operations only
      if (currentTranscriptionController) {
        currentTranscriptionController.abort();
        currentTranscriptionController = null;
      }
    },
    
    // Business Logic Implementation
    speakingStart: async (text: string, modeId?: string): Promise<void> => {
      // Don't start TTS if any window is recording
      if (get().audio.currentRecordingWindowId) {
        return;
      }

      // Stop any existing audio FIRST, before creating new controller
      await get().audioStop();
      
      // Now create a new controller for this audio generation
      currentAudioController = new AbortController();
      const signal = currentAudioController.signal;

      const store = get();
      
      // Get mode settings directly
      const effectiveModeId = modeId || DEFAULT_MODE_ID;
      const currentMode = store.modes.available[effectiveModeId];
      const defaultMode = getDefaultLNMode();
      
      // Debug logging for mode resolution
      if (modeId && !currentMode) {
        console.warn(`TTS: Mode '${modeId}' not found in available modes, falling back to default`);
        console.debug('Available mode keys:', Object.keys(store.modes.available));
      }

      // Validate TTS settings directly from mode
      const modeVoice = currentMode?.voice ?? defaultMode.voice;
      const voice = (modeVoice && TTS_VOICES.includes(modeVoice as TTSVoice)) 
        ? (modeVoice as TTSVoice) 
        : 'alloy';
      const speed = (currentMode?.voice_speed ?? defaultMode.voice_speed) || 1.0;
      const voiceAutoplay = currentMode?.voice_autoplay ?? defaultMode.voice_autoplay;
      
      console.debug(`TTS using mode '${effectiveModeId}' - Voice: '${voice}', Speed: ${speed}, Autoplay: ${voiceAutoplay}`);

      // Determine provider based on available API keys
      let provider: 'elevenlabs' | 'openai' = isElevenLabsAvailable() ? 'elevenlabs' : 'openai';
      
      // Generate cache key with validated parameters and provider
      const textHash = generateTextHash(text, voice, speed, provider);
      
      // Check cache first
      const cachedAudio = getCachedAudio(textHash);
      if (cachedAudio) {
        console.debug(`Using cached audio for text (${provider})`);
        return playCachedAudio(cachedAudio, signal);
      }

      // No cached audio found, generate new audio
      console.debug(`No cached audio found, generating new audio using ${provider}`);
      
      try {
        set((state) => {
          state.audio.isGeneratingSpeech = true;
        });
                
        // Handle abort signal
        if (signal.aborted) {
          return;
        }
        
        // Skip empty text
        if (!text || text.trim().length === 0) {
          console.debug('Skipping empty text in speakText');
          return;
        }
        
        const maxLength = 4096;
        const textToConvert = text.length > maxLength ? text.substring(0, maxLength) : text;
        
        let audioBlob: Blob | null = null;

        if (provider === 'elevenlabs') {
          console.debug('Using ElevenLabs for text-to-speech');
          console.debug(`ElevenLabs TTS API Call - OpenAI Voice: '${voice}', Speed: ${speed}, Text Length: ${textToConvert.length}`);
          
          try {
            const elevenLabsService = initializeElevenLabsService();
            if (!elevenLabsService) {
              throw new Error('Failed to initialize ElevenLabs service');
            }
            
            // Map OpenAI voice names to ElevenLabs voice IDs
            const voiceMapping: Record<string, string> = {
              'alloy': 'pNInz6obpgDQGcFmaJgB', // Adam - versatile male voice
              'echo': '21m00Tcm4TlvDq8ikWAM', // Rachel - calm female voice  
              'fable': 'AZnzlk1XvdvUeBnXmlld', // Domi - strong female voice
              'onyx': 'VR6AewLTigWG4xSOukaG', // Josh - deep male voice
              'nova': 'EXAVITQu4vr4xnSDxMaL', // Bella - expressive female voice
              'shimmer': 'ThT5KcBeYPX3keUQqHPh', // Dorothy - pleasant female voice
            };
            
            // Get ElevenLabs voice ID (fallback to default if mapping not found)
            const voiceId = voiceMapping[voice] || await elevenLabsService.getDefaultVoiceId();
            console.debug(`Mapped OpenAI voice '${voice}' to ElevenLabs voice ID: ${voiceId}`);
            
            // Convert OpenAI voice settings to ElevenLabs format
            const elevenLabsOptions = {
              model_id: 'eleven_multilingual_v2', // Default to high quality
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5,
                style: 0,
                use_speaker_boost: true,
              },
              output_format: 'mp3_44100_128',
            };
            
            audioBlob = await elevenLabsService.textToSpeech(textToConvert, voiceId, elevenLabsOptions);
            console.debug('ElevenLabs TTS completed successfully');
          } catch (elevenLabsError) {
            console.warn('ElevenLabs TTS failed, falling back to OpenAI:', elevenLabsError);
            // Fall through to OpenAI implementation
            provider = 'openai';
          }
        }

        if (provider === 'openai' || !audioBlob) {
          console.debug('Using OpenAI for text-to-speech');
          
          // Verify we have a valid API key
          const apiKey = getOpenAIApiKey();
          if (!apiKey) {
            console.error('No API key available for TTS (OpenAI or ElevenLabs)');
            new Notice(t('errors.audio.noApiKey'));
            return;
          }
          
          console.debug(`OpenAI TTS API Call - Voice: '${voice}', Speed: ${speed}, Text Length: ${textToConvert.length}`);

          // Generate audio using fetch API (similar to legacy TTS)
          const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini-tts',
              input: textToConvert,
              voice: voice,
              speed: speed,
              response_format: 'mp3'
            }),
            signal: signal
          });

          if (!response.ok) {
            throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
          }

          audioBlob = await response.blob();
          console.debug('OpenAI TTS completed successfully');
        }

        // Check for abort again after API call
        if (signal.aborted) {
          return;
        }
        
        // Ensure we have audio data
        if (!audioBlob) {
          throw new Error('Failed to generate audio from both ElevenLabs and OpenAI');
        }
        
        setCachedAudio(textHash, audioBlob, voice, speed, provider);

        // Check for abort again before playing audio
        if (signal.aborted) {
          return;
        }

        // Play the audio
        await playCachedAudio(audioBlob, signal);
        
      } catch (error) {
        console.error('Error during TTS:', error);
        if (!signal.aborted) {
          new Notice(t('errors.audio.transcriptionFailed'));
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