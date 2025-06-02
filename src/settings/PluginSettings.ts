import type MyPlugin from '../main';

export type TTSVoice = "alloy" | "ash" | "coral" | "echo" | "fable" | "onyx" | "nova" | "sage" | "shimmer";
export const TTS_VOICES: TTSVoice[] = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

export interface TutorialSettings {
	obsidianLanguageConfigured: boolean;
	openaiKeyConfigured: boolean; // Tracks if OpenAI has been configured or explicitly skipped
	// Future tutorial/setup related settings can be added here
}

export class PluginSettings {
	// Generic secrets system - allows any string -> string mapping
	secrets: Record<string, string> = {};
	speechToTextPrompt: string = '';
	activeModeId = '';
	tutorial: TutorialSettings = {
		obsidianLanguageConfigured: false,
		openaiKeyConfigured: false
	};
	private plugin: MyPlugin | undefined;

	public init(plugin: MyPlugin) {
		this.plugin = plugin;
	}

	async saveSettings(): Promise<void> {
		if (this.plugin) {
			await this.plugin.saveData(this);
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

let pluginInstance: PluginSettings;

export function createPluginSettings(plugin: MyPlugin): PluginSettings {
	const settings = new PluginSettings();
	settings.init(plugin);

	// Load existing settings - this will be called asynchronously in main.ts
	// For now, we'll just set up the structure and migration will happen in main.ts
	pluginInstance = settings;
	return settings;
}

export async function loadPluginSettings(plugin: MyPlugin): Promise<PluginSettings> {
	const settings = getPluginSettings();
	
	// Load existing settings
	const data = await plugin.loadData() || {};
	Object.assign(settings, data);

	// Migration: move old API keys to new secrets system with standard naming
	if ((data as any).openAIApiKey) {
		settings.setSecret('OPENAI_API_KEY', (data as any).openAIApiKey);
		// Don't delete old key yet to ensure backwards compatibility
	}
	
	if ((data as any).anthropicApiKey) {
		settings.setSecret('ANTHROPIC_API_KEY', (data as any).anthropicApiKey);
		// Don't delete old key yet to ensure backwards compatibility
	}
	
	if ((data as any).firecrawlApiKey) {
		settings.setSecret('FIRECRAWL_API_KEY', (data as any).firecrawlApiKey);
		// Don't delete old key yet to ensure backwards compatibility
	}

	// Save settings if migration occurred
	if ((data as any).openAIApiKey || (data as any).anthropicApiKey || (data as any).firecrawlApiKey) {
		await settings.saveSettings();
	}

	return settings;
}

export function getPluginSettings(): PluginSettings {
	if (!pluginInstance) {
		throw new Error('Plugin settings not initialized. Call createPluginSettings first.');
	}
	return pluginInstance;
}