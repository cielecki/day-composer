import { Message } from "./types";
import { extractTextForTTS, ensureContentBlocks } from "./content-blocks";
import { getDefaultLNMode } from "../mode/ln-mode-defaults";

export interface TTSContext {
	textToSpeech: {
		speakText: (text: string, signal: AbortSignal) => Promise<void>;
	};
	lnModesRef: React.MutableRefObject<Record<string, any>>;
	activeModeIdRef: React.MutableRefObject<string>;
	isRecording: boolean;
}

/**
 * Handles TTS for assistant messages based on mode settings
 */
export const handleTTS = async (
	finalAssistantMessage: Message | null,
	signal: AbortSignal,
	context: TTSContext
): Promise<void> => {
	if (!finalAssistantMessage) return;
	
	// Skip automatic TTS if recording is active
	if (context.isRecording) {
		return;
	}
	
	const contentBlocks = ensureContentBlocks(finalAssistantMessage.content);
	const textForTTS = extractTextForTTS(contentBlocks);
	
	// Use refs to get current mode instead of captured activeMode
	const defaultMode = getDefaultLNMode();
	const currentActiveMode = context.lnModesRef.current[context.activeModeIdRef.current];
	const autoplayEnabled = currentActiveMode?.ln_voice_autoplay || defaultMode.ln_voice_autoplay;
	
	// Only auto-play if both the global setting and the mode-specific autoplay are enabled
	if (autoplayEnabled && textForTTS.trim().length > 0) {
		try {
			await context.textToSpeech.speakText(textForTTS, signal);
			if (signal.aborted) {
				console.log("TTS aborted.");
			} else {
				console.log("TTS finished.");
			}
		} catch (ttsError) {
			console.error("Error during TTS:", ttsError);
		}
	}
}; 