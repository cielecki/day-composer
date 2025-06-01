import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Notice, App } from 'obsidian';
import OpenAI from 'openai';
import { getPluginSettings, TTSVoice } from "../settings/PluginSettings";
import { TTS_VOICES } from "../settings/PluginSettings";
import { t } from '../i18n';
import { DEFAULT_VOICE_INSTRUCTIONS } from "../utils/mode/ln-mode-defaults";
import { useLNMode } from './LNModeContext';
import { getDefaultLNMode } from '../utils/mode/ln-mode-defaults';
import { TTSStreamingService } from '../services/TTSStreamingService';

interface TextToSpeechContextType {
	isPlayingAudio: boolean;
	isGeneratingSpeech: boolean;
	speakText: (text: string, signal: AbortSignal, bypassEnabledCheck?: boolean) => Promise<void>;
	stopAudio: () => void;
}

const TextToSpeechContext = createContext<TextToSpeechContextType | undefined>(undefined);

export const TextToSpeechProvider: React.FC<{
	children: ReactNode;
}> = ({ children }) => {
	const [isPlayingAudio, setIsPlayingAudio] = useState(false);
	const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
	const { lnModesRef, activeModeIdRef } = useLNMode();
	
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
		const apiKey = getPluginSettings().openAIApiKey;
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
		setIsPlayingAudio(false);
		setIsGeneratingSpeech(false);
	}, []);
	
	const speakTextWithStreaming = useCallback(async (text: string, signal: AbortSignal): Promise<void> => {
		const service = initializeStreamingService();
		if (!service) {
			console.error('Failed to initialize streaming service');
			new Notice(t('errors.tts.noApiKey'));
			return;
		}

		try {
			setIsGeneratingSpeech(true);
			
			// Handle abort signal
			signal.addEventListener('abort', () => {
				service.stopStreaming();
				setIsPlayingAudio(false);
				setIsGeneratingSpeech(false);
			});

			await service.startStreaming(text, {
				onChunkReady: (chunk) => {
					console.log(`Streaming chunk ${chunk.position + 1} ready`);
				},
				
				onPlaybackStart: (chunk) => {
					console.log(`Started streaming chunk ${chunk.position + 1}`);
					setIsPlayingAudio(true);
					setIsGeneratingSpeech(false);
				},
				
				onPlaybackEnd: (chunk) => {
					console.log(`Finished streaming chunk ${chunk.position + 1}`);
					const progress = service.getProgress();
					
					// Check if all chunks are complete
					if (progress.current >= progress.total) {
						setIsPlayingAudio(false);
						setIsGeneratingSpeech(false);
					}
				},
				
				onError: (error, chunk) => {
					console.error('Streaming TTS Error:', error, chunk);
					new Notice(t('errors.tts.transcriptionFailed', { error }));
					setIsPlayingAudio(false);
					setIsGeneratingSpeech(false);
				}
			});

		} catch (error) {
			console.error('Streaming TTS failed:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown streaming error';
			new Notice(t('errors.tts.transcriptionFailed', { error: errorMessage }));
			setIsPlayingAudio(false);
			setIsGeneratingSpeech(false);
		}
	}, [initializeStreamingService]);

	const speakText = useCallback((text: string, signal: AbortSignal, bypassEnabledCheck = false): Promise<void> => {
		if (!bypassEnabledCheck && !getCurrentTTSSettings().enabled) {
			return Promise.resolve();
		}

		const settings = getPluginSettings();
		stopAudio();

		// Use streaming TTS if enabled and conditions are met
		if (text) {
			return speakTextWithStreaming(text, signal);
		}

		// Legacy TTS implementation (existing code)
		return new Promise((resolve, reject) => {
			// Create a new abort controller that we can reference later
			const controller = new AbortController();
			currentAudioController.current = controller;
			
			// Create a combined abort signal that will trigger if either the original signal
			// or our controller signal aborts
			const combinedSignal = {
				get aborted() {
					return signal.aborted || controller.signal.aborted;
				},
				addEventListener: (type: string, listener: EventListener) => {
					if (type === 'abort') {
						signal.addEventListener('abort', listener);
						controller.signal.addEventListener('abort', listener);
					}
				},
				removeEventListener: (type: string, listener: EventListener) => {
					if (type === 'abort') {
						signal.removeEventListener('abort', listener);
						controller.signal.removeEventListener('abort', listener);
					}
				},
				// Add missing AbortSignal properties
				onabort: null,
				reason: undefined,
				throwIfAborted: () => {},
				dispatchEvent: () => true
			} as AbortSignal;

			(async () => {
				try {
					setIsGeneratingSpeech(true); // Mark as playing while we're gathering chunks
							
					// Handle abort signal
					if (combinedSignal.aborted) {
						console.log('TTS operation was aborted before starting');
						resolve();
						return;
					}
					
					// Verify we have a valid API key
					if (!getPluginSettings().openAIApiKey) {
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
						apiKey: getPluginSettings().openAIApiKey,
						dangerouslyAllowBrowser: true
					});

					let voice: TTSVoice = 'alloy';

					if (getCurrentTTSSettings().voice) {
						if (!TTS_VOICES.includes(getCurrentTTSSettings().voice as TTSVoice)) {
							new Notice(t('errors.tts.invalidVoice', { voice: getCurrentTTSSettings().voice }));
						} else {
							voice = getCurrentTTSSettings().voice as TTSVoice;
						}
					}

					console.log('Using settings:', getCurrentTTSSettings());
					
					const response = await openai.audio.speech.create({
						model: "gpt-4o-mini-tts",
						voice: voice,
						instructions: getCurrentTTSSettings().instructions || DEFAULT_VOICE_INSTRUCTIONS,
						input: textToConvert,
						speed: getCurrentTTSSettings().speed || 1.0,
						response_format: "mp3",
					}, {
						signal: combinedSignal
					});

					// Check for abort again after API call
					if (combinedSignal.aborted) {
						console.log('TTS operation was aborted after API response');
						resolve();
						return;
					}

					// Get the response as a ReadableStream
					const stream = response.body;
					
					if (stream) {

						// Create streaming-like experience with sequential chunks
						console.log('Using sequential chunks for audio playback');
						
						// Play audio chunks sequentially to simulate streaming
						const reader = stream.getReader();
						const chunkSize = 1024 * 64; // 64KB chunks
						let audioBuffer: Uint8Array[] = [];
						let accumulatedSize = 0;
						
						// Function to play a chunk of audio
						let startedPlaying = false;
						const playNextChunk = (blob: Blob): Promise<void> => {
							if (!startedPlaying) {
								setIsPlayingAudio(true);
								startedPlaying = true;
							}

							return new Promise<void>((resolve, reject) => {
								// Create a new audio element for each chunk
								const currentAudioElement: HTMLAudioElement = new Audio();

								if (combinedSignal.aborted) {
									console.log('Playback aborted before starting');
									resolve();
									return;
								}

								// Handle abort signal for the entire promise
								combinedSignal.addEventListener('abort', () => {
									resolve();
									currentAudioElement!.pause();
								});
								
								const audioUrl = URL.createObjectURL(blob);
								
								combinedSignal.addEventListener('abort', () => {
									currentAudioElement!.pause();
								});
								
								// Set up event handlers for both end and pause events
								const handlePlaybackEnd = () => {
									console.log('Chunk playback ended');
									URL.revokeObjectURL(audioUrl);
									
									if (combinedSignal.aborted) {
										console.log('Playback aborted, not playing next chunk');
										resolve();
										return;
									}
									
									resolve();
								};

								currentAudioElement.onended = handlePlaybackEnd;
								currentAudioElement.onpause = handlePlaybackEnd;
								
								currentAudioElement.onplay = () => {
									console.log('Chunk playback started');
								};
								
								currentAudioElement.onerror = (e) => {
									console.error('Error playing audio chunk:', e);
									URL.revokeObjectURL(audioUrl);
									
									const errorMessage = currentAudioElement?.error 
										? `Audio error: ${currentAudioElement.error.code} - ${currentAudioElement.error.message}`
										: 'Unknown audio playback error';
									console.error(errorMessage);
									
									reject(new Error(errorMessage));
								};
								
								// Set the source and play
								currentAudioElement.src = audioUrl;
								
								currentAudioElement.play().catch(err => {
									console.error('Error playing audio:', err);
									setIsPlayingAudio(false);
									new Notice(t('errors.audio.playbackError', { error: err instanceof Error ? err.message : String(err) }));
									reject(err);
								});
							});
						};
						
						try {
							let shouldContinue = true;
							
							const processChunk = () => {
								console.log(`Starting playback with ${audioBuffer.length} chunks, ${accumulatedSize} bytes`);
								const blob = new Blob(audioBuffer, { type: 'audio/mpeg' });
								audioBuffer = [];
								accumulatedSize = 0;
								return playNextChunk(blob);
							};

							do {
								if (combinedSignal.aborted) {
									console.log('Aborting audio stream processing');
									break;
								}
								
								const { done, value } = await reader.read();
								
								if (done) {
									console.log('Stream reading complete');
									shouldContinue = false;
									break;
								}
								
								if (value) {
									audioBuffer.push(value);
									accumulatedSize += value.byteLength;
								}
								
								// When we've accumulated enough data, start playing
								if (accumulatedSize >= chunkSize) {
									if (combinedSignal.aborted) {
										console.log('Aborted before playing first chunk');
										break;
									}
									
									await processChunk();
								}
							} while (shouldContinue);
							
							// Play any remaining audio
							if (audioBuffer.length > 0 && !combinedSignal.aborted) {
								console.log(`Playing all remaining audio: ${audioBuffer.length} chunks`);
								const blob = new Blob(audioBuffer, { type: 'audio/mpeg' });
								await playNextChunk(blob);
							} else if (!combinedSignal.aborted) {
								// If we got no data at all
								console.log('No more audio data.');
							}
						} catch (err) {
							console.error('Error streaming audio chunks:', err);
							new Notice(t('errors.audio.playbackError', { error: err instanceof Error ? err.message : String(err) }));
						}
					} else {
						console.error('No audio stream received from API');
						new Notice(t('errors.audio.noData'));
					}
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
					currentAudioController.current = null;
				}
			})();
		});
	}, [getCurrentTTSSettings, stopAudio]);

	// Build context value
	const value = {
		isPlayingAudio,
		isGeneratingSpeech,
		speakText,
		stopAudio,
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