import { getPluginSettings } from "../settings/PluginSettings";

export enum SetupStep {
	CONFIGURE_LANGUAGE = "configure_language",
	CREATE_STARTER_KIT = "create_starter_kit",
	CONFIGURE_ANTHROPIC_KEY = "configure_anthropic_key", 
	CONFIGURE_OPENAI_KEY = "configure_openai_key",
	COMPLETE = "complete"
}

export interface SetupState {
	currentStep: SetupStep;
	hasLanguageConfigured: boolean;
	hasModes: boolean;
	hasAnthropicKey: boolean;
	hasOpenAIKey: boolean;
	hasOpenAIConfigured: boolean; // Whether OpenAI has been configured or explicitly skipped
}

/**
 * Determines the current setup state based on language setting, available modes and API keys
 */
export function getSetupState(lnModes: Record<string, any>): SetupState {
	const settings = getPluginSettings();
	
	const hasLanguageConfigured = settings.tutorial.obsidianLanguageConfigured;
	const hasModes = Object.keys(lnModes).length > 0;
	const hasAnthropicKey = Boolean(settings.getSecret('ANTHROPIC_API_KEY') && settings.getSecret('ANTHROPIC_API_KEY')!.trim().length > 0);
	const hasOpenAIKey = Boolean(settings.getSecret('OPENAI_API_KEY') && settings.getSecret('OPENAI_API_KEY')!.trim().length > 0);
	const hasOpenAIConfigured = settings.tutorial.openaiKeyConfigured;
	
	let currentStep: SetupStep;
	
	if (!hasLanguageConfigured) {
		currentStep = SetupStep.CONFIGURE_LANGUAGE;
	} else if (!hasModes) {
		currentStep = SetupStep.CREATE_STARTER_KIT;
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
		hasModes,
		hasAnthropicKey,
		hasOpenAIKey,
		hasOpenAIConfigured
	};
}

/**
 * Checks if setup is complete (all required components are configured)
 */
export function isSetupComplete(lnModes: Record<string, any>): boolean {
	const state = getSetupState(lnModes);
	return state.currentStep === SetupStep.COMPLETE;
} 