import { Message } from "./types";
import { extractTextForTTS, ensureContentBlocks } from "./content-blocks";
import { getDefaultLNMode } from "../mode/ln-mode-defaults";
import { getStore } from "../../store/plugin-store";

/**
 * Handles TTS for assistant messages based on mode settings
 */
export const handleTTS = async (
	finalAssistantMessage: Message | null,
	signal: AbortSignal
): Promise<void> => {
	if (!finalAssistantMessage) return;
	
	// Skip automatic TTS if recording is active
	if (getStore().stt.isRecording) {
		return;
	}
	
	const contentBlocks = ensureContentBlocks(finalAssistantMessage.content);
	const textForTTS = extractTextForTTS(contentBlocks);
	
	// Get current mode and check autoplay setting
	const defaultMode = getDefaultLNMode();
	const currentActiveMode = getStore().modes.available[getStore().modes.activeId];
	const autoplayEnabled = currentActiveMode?.ln_voice_autoplay || defaultMode.ln_voice_autoplay;
	
	// Only auto-play if both the global setting and the mode-specific autoplay are enabled
	if (autoplayEnabled && textForTTS.trim().length > 0) {
		try {
			await getStore().speakText(textForTTS, signal);
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