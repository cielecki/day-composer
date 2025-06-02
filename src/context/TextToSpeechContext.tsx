import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Notice, App } from 'obsidian';
import OpenAI from 'openai';
import { getPluginSettings, TTSVoice } from "../settings/LifeNavigatorSettings";
import { TTS_VOICES } from "../settings/LifeNavigatorSettings";
import { t } from '../i18n';
import { DEFAULT_VOICE_INSTRUCTIONS } from "../utils/mode/ln-mode-defaults";
import { useLNMode } from './LNModeContext';
import { getDefaultLNMode } from '../utils/mode/ln-mode-defaults';
import { TTSStreamingService } from '../services/TTSStreamingService';

// Cache interface for storing generated audio
interface TTSCache {
	[textHash: string]: {
		audioBlob: Blob;
		timestamp: number;
		voice: string;
		speed: number;
	};
}

interface TextToSpeechContextType {
	isPlayingAudio: boolean;
	isGeneratingSpeech: boolean;
	isPaused: boolean;
	speakText: (text: string, signal: AbortSignal, bypassEnabledCheck?: boolean) => Promise<void>;
	stopAudio: () => void;
	pauseAudio: () => void;
	resumeAudio: () => void;
	clearCache: () => void;
}

const TextToSpeechContext = createContext<TextToSpeechContextType | undefined>(undefined);

export const TextToSpeechProvider: React.FC<{
	children: ReactNode;
}> = ({ children }) => {
	const [isPlayingAudio, setIsPlayingAudio] = useState(false);
	const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const { lnModesRef, activeModeIdRef } = useLNMode();
	
	// Audio cache - stores generated audio blobs
	const audioCacheRef = React.useRef<TTSCache>({});
	
	// Current audio element reference for pause/resume
	const currentAudioElementRef = React.useRef<HTMLAudioElement | null>(null);
	
	// Streaming service ref
	const streamingServiceRef = React.useRef<TTSStreamingService | null>(null);
	
	// Helper function to get current TTS settings from active mode
	const getCurrentTTSSettings = useCallback(() => {
		const currentMode = lnModesRef.current[activeModeIdRef.current];
		const defaultMode = getDefaultLNMode();
		
		return {
			enabled: currentMode?.ln_voice_autoplay ?? defaultMode.ln_voice_autoplay,
			voice: currentMode?.ln_voice ?? defaultMode.ln_voice,
			instructions: currentMode?.ln_voice_instructions ?? defaultMode.ln_voice_instructions,
			speed: currentMode?.ln_voice_speed ?? defaultMode.ln_voice_speed,
		};
	}, [lnModesRef, activeModeIdRef]);
	
	// Initialize streaming service when needed
	const initializeStreamingService = useCallback(() => {
		const apiKey = getPluginSettings().getSecret('OPENAI_API_KEY');
		const settings = getCurrentTTSSettings();
		
		if (apiKey && !streamingServiceRef.current) {
			streamingServiceRef.current = new TTSStreamingService(
				apiKey, 
				(settings.voice as TTSVoice) || 'alloy', 
				settings.speed || 1.0
			);
		}
		return streamingServiceRef.current;
	}, [getCurrentTTSSettings]);
	
	// Ref to track the current playing state to avoid stale closure issues
	const isPlayingRef = React.useRef(false);
	
	// Create a ref to store the current abort controller
	const currentAudioController = React.useRef<AbortController | null>(null);
	
	// Update ref whenever state changes
	useEffect(() => {
		isPlayingRef.current = isPlayingAudio;
	}, [isPlayingAudio]);
	
	// Helper function to generate hash for cache key
	const generateTextHash = useCallback((text: string, voice: string, speed: number): string => {
		// Simple hash function for cache key
		const str = `${text}-${voice}-${speed}`;
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return hash.toString(36);
	}, []);

	// Cache management
	const getCachedAudio = useCallback((textHash: string): Blob | null => {
		const cached = audioCacheRef.current[textHash];
		if (cached) {
			// Check if cache is not too old (1 hour)
			const isExpired = Date.now() - cached.timestamp > 60 * 60 * 1000;
			if (isExpired) {
				delete audioCacheRef.current[textHash];
				return null;
			}
			return cached.audioBlob;
		}
		return null;
	}, []);

	const setCachedAudio = useCallback((textHash: string, audioBlob: Blob, voice: string, speed: number) => {
		audioCacheRef.current[textHash] = {
			audioBlob,
			timestamp: Date.now(),
			voice,
			speed
		};
		
		// Clean up old cache entries (keep only 10 most recent)
		const entries = Object.entries(audioCacheRef.current);
		if (entries.length > 10) {
			entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
			audioCacheRef.current = Object.fromEntries(entries.slice(0, 10));
		}
	}, []);
	
	// Function to stop the currently playing audio
	const stopAudio = useCallback(() => {
		if (streamingServiceRef.current) {
			// Stop streaming TTS
			streamingServiceRef.current.stopStreaming();
		}
		
		if (currentAudioController.current) {
			// Stop legacy TTS
			currentAudioController.current.abort();
			currentAudioController.current = null;
		}
		
		if (currentAudioElementRef.current) {
			currentAudioElementRef.current.pause();
			currentAudioElementRef.current = null;
		}
		
		setIsPlayingAudio(false);
		setIsGeneratingSpeech(false);
		setIsPaused(false);
	}, []);

	// Function to pause the currently playing audio
	const pauseAudio = useCallback(() => {
		if (streamingServiceRef.current && streamingServiceRef.current.isCurrentlyPlaying()) {
			streamingServiceRef.current.pauseStreaming();
			setIsPaused(true);
			setIsPlayingAudio(false);
		} else if (currentAudioElementRef.current && !currentAudioElementRef.current.paused) {
			currentAudioElementRef.current.pause();
			setIsPaused(true);
			setIsPlayingAudio(false);
		}
	}, []);

	// Function to resume the currently paused audio
	const resumeAudio = useCallback(() => {
		if (streamingServiceRef.current && isPaused) {
			streamingServiceRef.current.resumeStreaming();
			setIsPaused(false);
			setIsPlayingAudio(true);
		} else if (currentAudioElementRef.current && isPaused) {
			currentAudioElementRef.current.play().then(() => {
				setIsPaused(false);
				setIsPlayingAudio(true);
			}).catch(err => {
				console.error('Error resuming audio:', err);
				setIsPaused(false);
			});
		} else if (isPaused && !currentAudioElementRef.current) {
			// Audio element is null (audio finished naturally), clear paused state
			console.log('Audio finished naturally, clearing paused state');
			setIsPaused(false);
		}
	}, [isPaused]);

	// Clear cache function
	const clearCache = useCallback(() => {
		audioCacheRef.current = {};
	}, []);

	// Helper function to play cached audio
	const playCachedAudio = useCallback((audioBlob: Blob, signal: AbortSignal): Promise<void> => {
		return new Promise<void>((resolve, reject) => {
			const audioElement = new Audio();
			currentAudioElementRef.current = audioElement;
			
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
				currentAudioElementRef.current = null;
				
				if (signal.aborted) {
					resolve();
					return;
				}
				
				setIsPlayingAudio(false);
				setIsPaused(false); // Reset paused state when audio ends
				resolve();
			};

			audioElement.onended = handlePlaybackEnd;
			// Remove the onpause handler - we'll handle pause state manually
			
			audioElement.onplay = () => {
				setIsPlayingAudio(true);
				setIsGeneratingSpeech(false);
			};
			
			audioElement.onerror = (e) => {
				console.error('Error playing cached audio:', e);
				URL.revokeObjectURL(audioUrl);
				currentAudioElementRef.current = null;
				
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
				setIsPlayingAudio(false);
				new Notice(t('errors.audio.playbackError', { error: err instanceof Error ? err.message : String(err) }));
				reject(err);
			});
		});
	}, [isPaused]);

	// Legacy TTS with caching
	const speakTextWithLegacyAndCache = useCallback((text: string, signal: AbortSignal, textHash: string, ttsSettings: any): Promise<void> => {
		return new Promise((resolve, reject) => {
			// Use the provided signal directly (controller is created in speakText)
			const combinedSignal = signal;

			(async () => {
				try {
					setIsGeneratingSpeech(true); // Mark as playing while we're gathering chunks
							
					// Handle abort signal
					if (combinedSignal.aborted) {
						resolve();
						return;
					}
					
					// Verify we have a valid API key
					if (!getPluginSettings().getSecret('OPENAI_API_KEY')) {
						console.error('No OpenAI API key available for TTS');
						new Notice(t('errors.tts.noApiKey'));
						resolve();
						return;
					}
					
					// Skip empty text
					if (!text || text.trim().length === 0) {
						console.log('Skipping empty text in playAudio');
						resolve();
						return;
					}
					
					const maxLength = 4096;
					const textToConvert = text.length > maxLength ? text.substring(0, maxLength) : text;
					
					console.log('Creating OpenAI client and sending TTS request');
					const openai = new OpenAI({
						apiKey: getPluginSettings().getSecret('OPENAI_API_KEY'),
						dangerouslyAllowBrowser: true
					});

					let voice: TTSVoice = 'alloy';

					if (ttsSettings.voice) {
						if (!TTS_VOICES.includes(ttsSettings.voice as TTSVoice)) {
							new Notice(t('errors.tts.invalidVoice', { voice: ttsSettings.voice }));
						} else {
							voice = ttsSettings.voice as TTSVoice;
						}
					}

					console.log('Using settings:', ttsSettings);
					
					const response = await openai.audio.speech.create({
						model: "gpt-4o-mini-tts",
						voice: voice,
						instructions: ttsSettings.instructions || DEFAULT_VOICE_INSTRUCTIONS,
						input: textToConvert,
						speed: ttsSettings.speed || 1.0,
						response_format: "mp3",
					}, {
						signal: combinedSignal
					});

					// Check for abort again after API call
					if (combinedSignal.aborted) {
						resolve();
						return;
					}

					// Get the response as a blob and cache it
					const audioBlob = await response.blob();
					
					// Check for abort again after blob conversion
					if (combinedSignal.aborted) {
						resolve();
						return;
					}
					
					setCachedAudio(textHash, audioBlob, voice, ttsSettings.speed || 1.0);

					// Check for abort again before playing audio
					if (combinedSignal.aborted) {
						resolve();
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
					reject(error);
				} finally {
					setIsPlayingAudio(false);
					setIsGeneratingSpeech(false);
					// Don't clear currentAudioController.current here since it's managed in speakText
				}
			})();
		});
	}, [setCachedAudio, playCachedAudio]);
	
	const speakText = useCallback((text: string, signal: AbortSignal, bypassEnabledCheck = false): Promise<void> => {
		if (!bypassEnabledCheck && !getCurrentTTSSettings().enabled) {
			return Promise.resolve();
		}

		const settings = getPluginSettings();
		const ttsSettings = getCurrentTTSSettings();
		stopAudio();

		// Create our own internal abort controller that stopAudio can access
		const internalController = new AbortController();
		currentAudioController.current = internalController;

		// Create a combined signal that responds to both external signal and internal controller
		const combinedSignal = {
			get aborted() {
				return signal.aborted || internalController.signal.aborted;
			},
			addEventListener: (type: string, listener: EventListener) => {
				if (type === 'abort') {
					signal.addEventListener('abort', (event) => {
						listener(event);
					});
					internalController.signal.addEventListener('abort', (event) => {
						listener(event);
					});
				}
			},
			removeEventListener: (type: string, listener: EventListener) => {
				if (type === 'abort') {
					signal.removeEventListener('abort', listener);
					internalController.signal.removeEventListener('abort', listener);
				}
			},
			// Add missing AbortSignal properties
			onabort: null,
			reason: undefined,
			throwIfAborted: () => {},
			dispatchEvent: () => true
		} as AbortSignal;

		// Generate cache key
		const textHash = generateTextHash(text, ttsSettings.voice || 'alloy', ttsSettings.speed || 1.0);
		
		// Check cache first - regardless of TTS method
		const cachedAudio = getCachedAudio(textHash);
		if (cachedAudio) {
			console.log('Using cached audio for text');
			return playCachedAudio(cachedAudio, combinedSignal).finally(() => {
				// Clean up controller after cached audio finishes
				if (currentAudioController.current === internalController) {
					currentAudioController.current = null;
				}
			});
		}

		// No cached audio found, generate new audio using legacy TTS for caching
		console.log('No cached audio found, generating new audio with legacy TTS for caching');
		return speakTextWithLegacyAndCache(text, combinedSignal, textHash, ttsSettings).finally(() => {
			// Clean up controller after TTS generation finishes
			if (currentAudioController.current === internalController) {
				currentAudioController.current = null;
			}
		});
	}, [getCurrentTTSSettings, stopAudio, generateTextHash, getCachedAudio, playCachedAudio, speakTextWithLegacyAndCache]);

	// Build context value
	const value = {
		isPlayingAudio,
		isGeneratingSpeech,
		isPaused,
		speakText,
		stopAudio,
		pauseAudio,
		resumeAudio,
		clearCache,
	};

	return (
		<TextToSpeechContext.Provider value={value}>
			{children}
		</TextToSpeechContext.Provider>
	);
};

// Custom hook for using the Text To Speech context
export const useTextToSpeech = () => {
	const context = useContext(TextToSpeechContext);
	if (context === undefined) {
		throw new Error('useTextToSpeech must be used within a TextToSpeechProvider');
	}
	return context;
};