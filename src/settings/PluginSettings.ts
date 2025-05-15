import type MyPlugin from '../main';


export type TTSVoice = "alloy" | "ash" | "coral" | "echo" | "fable" | "onyx" | "nova" | "sage" | "shimmer";
export const TTS_VOICES: TTSVoice[] = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

export class PluginSettings {
	openAIApiKey = ''; // OpenAI API key for text-to-speech
	anthropicApiKey = ''; // Anthropic API key for text-to-speech
    plugin: MyPlugin;

    constructor() {}

    async init(plugin: MyPlugin) {
        this.plugin = plugin;
        
        const data = await plugin.loadData();

        this.openAIApiKey = data.openAIApiKey ?? this.openAIApiKey;
        this.anthropicApiKey = data.anthropicApiKey ?? this.anthropicApiKey;
    }

    async saveSettings() {
        await this.plugin.saveData({
            openAIApiKey: this.openAIApiKey,
            anthropicApiKey: this.anthropicApiKey,
        });
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