import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Notice } from 'obsidian';
import OpenAI from 'openai';
import { getPluginSettings, TTSVoice } from "../settings/PluginSettings";
import { TTS_VOICES } from "../settings/PluginSettings";
import { t } from '../i18n';
import { DEFAULT_VOICE_INSTRUCTIONS } from 'src/defaults/ln-mode-defaults';

interface TTSSettings {
	enabled: boolean;
	voice?: string;
	instructions?: string;
	speed?: number;
}

interface TextToSpeechContextType {
	isPlayingAudio: boolean;
	isGeneratingSpeech: boolean;
	ttsSettings: TTSSettings;
	setTTSSettings: (settings: TTSSettings) => void;
	speakText: (text: string, signal: AbortSignal, bypassEnabledCheck?: boolean) => Promise<void>;
	stopAudio: () => void;
}

const TextToSpeechContext = createContext<TextToSpeechContextType | undefined>(undefined);

export const TextToSpeechProvider: React.FC<{
	children: ReactNode;
}> = ({ children }) => {
	const [isPlayingAudio, setIsPlayingAudio] = useState(false);
	const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
	const [ttsSettings, setTTSSettings] = useState<TTSSettings>({
		enabled: true,
		voice: 'alloy',
		instructions: DEFAULT_VOICE_INSTRUCTIONS,
		speed: 1.0
	});
	
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
		if (currentAudioController.current) {
			currentAudioController.current.abort();
			currentAudioController.current = null;
			setIsPlayingAudio(false);
			setIsGeneratingSpeech(false);
		}
	}, []);
	
	const speakText = useCallback((text: string, signal: AbortSignal, bypassEnabledCheck = false): Promise<void> => {
		return new Promise((resolve, reject) => {
			if (!bypassEnabledCheck && !ttsSettings.enabled) {
				resolve();
				return;
			}

			// First stop any currently playing audio
			stopAudio();
			
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

					if (ttsSettings.voice) {
						if (!TTS_VOICES.includes(ttsSettings.voice as TTSVoice)) {
							new Notice(t('errors.tts.invalidVoice').replace('{{voice}}', ttsSettings.voice));
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
									console.error('Failed to play audio chunk:', err);
									new Notice(t('errors.audio.playback'));
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
							new Notice(t('errors.audio.playbackError').replace('{{error}}', err instanceof Error ? err.message : String(err)));
						}
					} else {
						console.error('No audio stream received from API');
						new Notice(t('errors.audio.noData'));
					}
				} catch (error) {
					console.error('Error during TTS:', error);
					if (!combinedSignal.aborted) {
						const errorMessage = error instanceof Error ? error.message : 'Unknown error during TTS';
						new Notice(t('errors.tts.transcriptionFailed').replace('{{error}}', errorMessage));
					}
					reject(error);
				} finally {
					setIsPlayingAudio(false);
					setIsGeneratingSpeech(false);
					currentAudioController.current = null;
				}
			})();
		});
	}, [ttsSettings, stopAudio]);

	// Build context value
	const value = {
		isPlayingAudio,
		isGeneratingSpeech,
		ttsSettings,
		setTTSSettings: (settings: TTSSettings) => {
			console.log('Setting TTS settings:', settings);
			setTTSSettings(settings);
		},
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