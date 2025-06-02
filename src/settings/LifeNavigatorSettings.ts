import type { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';

export type TTSVoice = "alloy" | "ash" | "coral" | "echo" | "fable" | "onyx" | "nova" | "sage" | "shimmer";
export const TTS_VOICES: TTSVoice[] = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

export interface TutorialSettings {
	obsidianLanguageConfigured: boolean;
	openaiKeyConfigured: boolean; // Tracks if OpenAI has been configured or explicitly skipped
	// Future tutorial/setup related settings can be added here
}

export class LifeNavigatorSettings {
	// Generic secrets system - allows any string -> string mapping
	secrets: Record<string, string> = {};
	speechToTextPrompt: string = '';
	activeModeId = '';
	tutorial: TutorialSettings = {
		obsidianLanguageConfigured: false,
		openaiKeyConfigured: false
	};
	private plugin: LifeNavigatorPlugin | undefined;

	public init(plugin: LifeNavigatorPlugin) {
		this.plugin = plugin;
	}

	async saveSettings(): Promise<void> {
		if (this.plugin) {
			// Create a copy of the current object and remove legacy properties
			const dataToSave = { ...this };
			
			// Remove legacy API key properties
			delete (dataToSave as any).openAIApiKey;
			delete (dataToSave as any).anthropicApiKey;
			delete (dataToSave as any).firecrawlApiKey;
			
			// Remove the plugin reference as it shouldn't be serialized
			delete (dataToSave as any).plugin;
			
			await this.plugin.saveData(dataToSave);
		}
	}

	// Secret management methods
	getSecretKeys(): string[] {
		return Object.keys(this.secrets || {});
	}

	getSecret(key: string): string | undefined {
		return this.secrets?.[key];
	}

	setSecret(key: string, value: string): void {
		if (!this.secrets) {
			this.secrets = {};
		}
		this.secrets[key] = value;
	}

	removeSecret(key: string): void {
		if (this.secrets) {
			delete this.secrets[key];
		}
	}

	// Reset tutorial/setup state
	async resetTutorial() {
		this.tutorial = {
			obsidianLanguageConfigured: false,
			openaiKeyConfigured: false
		};
		await this.saveSettings();
	}

	// Getter for backward compatibility
	get obsidianLanguageConfigured(): boolean {
		return this.tutorial.obsidianLanguageConfigured;
	}

	// Setter for backward compatibility
	set obsidianLanguageConfigured(value: boolean) {
		this.tutorial.obsidianLanguageConfigured = value;
	}

	get openaiKeyConfigured(): boolean {
		return this.tutorial.openaiKeyConfigured;
	}

	set openaiKeyConfigured(value: boolean) {
		this.tutorial.openaiKeyConfigured = value;
	}
}

let pluginInstance: LifeNavigatorSettings;

export function createPluginSettings(plugin: LifeNavigatorPlugin): LifeNavigatorSettings {
	const settings = new LifeNavigatorSettings();
	settings.init(plugin);

	// Load existing settings - this will be called asynchronously in main.ts
	// For now, we'll just set up the structure and migration will happen in main.ts
	pluginInstance = settings;
	return settings;
}

export async function loadPluginSettings(plugin: LifeNavigatorPlugin): Promise<LifeNavigatorSettings> {
	const settings = getPluginSettings();
	
	// Load existing settings
	const data = await plugin.loadData() || {};
	
	// First, safely copy non-conflicting properties
	const { openAIApiKey, anthropicApiKey, firecrawlApiKey, ...safeData } = data as any;
	Object.assign(settings, safeData);

	// Ensure secrets object exists
	if (!settings.secrets) {
		settings.secrets = {};
	}

	let migrationOccurred = false;

	// Migration: move old API keys to new secrets system with standard naming
	if (openAIApiKey) {
		settings.setSecret('OPENAI_API_KEY', openAIApiKey);
		migrationOccurred = true;
	}
	
	if (anthropicApiKey) {
		settings.setSecret('ANTHROPIC_API_KEY', anthropicApiKey);
		migrationOccurred = true;
	}
	
	if (firecrawlApiKey) {
		settings.setSecret('FIRECRAWL_API_KEY', firecrawlApiKey);
		migrationOccurred = true;
	}

	// Save settings if migration occurred to persist the new format and remove old keys
	if (migrationOccurred) {
		await settings.saveSettings();
	}

	return settings;
}

export function getPluginSettings(): LifeNavigatorSettings {
	if (!pluginInstance) {
		throw new Error('Plugin settings not initialized. Call createPluginSettings first.');
	}
	return pluginInstance;
}