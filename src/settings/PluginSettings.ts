import type MyPlugin from '../main';

export type TTSVoice = "alloy" | "ash" | "coral" | "echo" | "fable" | "onyx" | "nova" | "sage" | "shimmer";
export const TTS_VOICES: TTSVoice[] = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

export class PluginSettings {
	openAIApiKey = '';
	anthropicApiKey = '';
	speechToTextPrompt = '';
    plugin: MyPlugin;

    constructor() {}

    async init(plugin: MyPlugin) {
        this.plugin = plugin;
        
        const data = await plugin.loadData();

        this.openAIApiKey = data?.openAIApiKey ?? '';
        this.anthropicApiKey = data?.anthropicApiKey ?? '';
        this.speechToTextPrompt = data?.speechToTextPrompt ?? '';
    }

    async saveSettings() {
        const settingsToSave = {
            openAIApiKey: this.openAIApiKey,
            anthropicApiKey: this.anthropicApiKey,
            speechToTextPrompt: this.speechToTextPrompt,
        };
        await this.plugin.saveData(settingsToSave);
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