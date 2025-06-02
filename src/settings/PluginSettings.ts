import type MyPlugin from '../main';

export type TTSVoice = "alloy" | "ash" | "coral" | "echo" | "fable" | "onyx" | "nova" | "sage" | "shimmer";
export const TTS_VOICES: TTSVoice[] = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

export interface TutorialSettings {
	obsidianLanguageConfigured: boolean;
	openaiKeyConfigured: boolean; // Tracks if OpenAI has been configured or explicitly skipped
	// Future tutorial/setup related settings can be added here
}

export class PluginSettings {
	openAIApiKey = '';
	anthropicApiKey = '';
	firecrawlApiKey = '';
	speechToTextPrompt = '';
	activeModeId = '';
	userDefinedToolsEnabled = false; // Default disabled for security
	tutorial: TutorialSettings = {
		obsidianLanguageConfigured: false,
		openaiKeyConfigured: false
	};
    plugin: MyPlugin;

    constructor() {}

    async init(plugin: MyPlugin) {
        this.plugin = plugin;
        
        const data = await plugin.loadData();

        this.openAIApiKey = data?.openAIApiKey ?? '';
        this.anthropicApiKey = data?.anthropicApiKey ?? '';
        this.firecrawlApiKey = data?.firecrawlApiKey ?? '';
        this.speechToTextPrompt = data?.speechToTextPrompt ?? '';
        this.activeModeId = data?.activeModeId ?? '';
        this.userDefinedToolsEnabled = data?.userDefinedToolsEnabled ?? false;
        
        // Handle migration from old obsidianLanguageConfigured field
        if (data?.obsidianLanguageConfigured !== undefined) {
        	this.tutorial = {
        		obsidianLanguageConfigured: data.obsidianLanguageConfigured,
        		openaiKeyConfigured: data.openaiKeyConfigured ?? false
        	};
        } else {
        	this.tutorial = data?.tutorial ?? {
        		obsidianLanguageConfigured: false,
        		openaiKeyConfigured: false
        	};
        }
    }

    async saveSettings() {
        const settingsToSave = {
            openAIApiKey: this.openAIApiKey,
            anthropicApiKey: this.anthropicApiKey,
            firecrawlApiKey: this.firecrawlApiKey,
            speechToTextPrompt: this.speechToTextPrompt,
            activeModeId: this.activeModeId,
            userDefinedToolsEnabled: this.userDefinedToolsEnabled,
            tutorial: this.tutorial,
        };
        await this.plugin.saveData(settingsToSave);
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

// Singleton pattern for PluginSettings
let instance: PluginSettings | null = null;

export function getPluginSettings(): PluginSettings {
    if (!instance) {
        instance = new PluginSettings();
    }
    return instance;
}

export function resetPluginSettings(): void {
    instance = null;
}