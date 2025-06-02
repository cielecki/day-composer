import { getPluginSettings } from "../settings/LifeNavigatorSettings";

export enum SetupStep {
	CONFIGURE_LANGUAGE = "configure_language",
	CONFIGURE_ANTHROPIC_KEY = "configure_anthropic_key", 
	CONFIGURE_OPENAI_KEY = "configure_openai_key",
	COMPLETE = "complete"
}

export interface SetupState {
	currentStep: SetupStep;
	hasLanguageConfigured: boolean;
	hasAnthropicKey: boolean;
	hasOpenAIKey: boolean;
	hasOpenAIConfigured: boolean; // Whether OpenAI has been configured or explicitly skipped
}

/**
 * Determines the current setup state based on language setting and API keys
 * Pre-built modes are always available, so mode creation is no longer required
 */
export function getSetupState(): SetupState {
	const settings = getPluginSettings();
	
	const hasLanguageConfigured = settings.tutorial.obsidianLanguageConfigured;
	const hasAnthropicKey = Boolean(settings.getSecret('ANTHROPIC_API_KEY') && settings.getSecret('ANTHROPIC_API_KEY')!.trim().length > 0);
	const hasOpenAIKey = Boolean(settings.getSecret('OPENAI_API_KEY') && settings.getSecret('OPENAI_API_KEY')!.trim().length > 0);
	const hasOpenAIConfigured = settings.tutorial.openaiKeyConfigured;
	
	let currentStep: SetupStep;
	
	if (!hasLanguageConfigured) {
		currentStep = SetupStep.CONFIGURE_LANGUAGE;
	} else if (!hasAnthropicKey) {
		currentStep = SetupStep.CONFIGURE_ANTHROPIC_KEY;
	} else if (!hasOpenAIKey && !hasOpenAIConfigured) {
		currentStep = SetupStep.CONFIGURE_OPENAI_KEY;
	} else {
		currentStep = SetupStep.COMPLETE;
	}
	
	return {
		currentStep,
		hasLanguageConfigured,
		hasAnthropicKey,
		hasOpenAIKey,
		hasOpenAIConfigured
	};
}

/**
 * Checks if setup is complete (all required components are configured)
 * Pre-built modes are always available, so we only check for API keys
 */
export function isSetupComplete(): boolean {
	const state = getSetupState();
	return state.currentStep === SetupStep.COMPLETE;
}

/**
 * Reset tutorial state to show setup screens again
 */
export async function resetTutorialState(): Promise<void> {
	const settings = getPluginSettings();
	settings.tutorial.obsidianLanguageConfigured = false;
	settings.tutorial.openaiKeyConfigured = false;
	await settings.saveSettings();
} 