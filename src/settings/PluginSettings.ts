import type MyPlugin from '../main';


export type TTSVoice = "alloy" | "ash" | "coral" | "echo" | "fable" | "onyx" | "nova" | "sage" | "shimmer";
export const TTS_VOICES: TTSVoice[] = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

export class PluginSettings {
	openAIApiKey = ''; // OpenAI API key for text-to-speech
	anthropicApiKey = ''; // Anthropic API key for text-to-speech
    enableTextToSpeech = true; // Whether to enable text-to-speech
    plugin: MyPlugin;

    constructor() {}

    async init(plugin: MyPlugin) {
        this.plugin = plugin;
        
        const data = await plugin.loadData();

        this.openAIApiKey = data.openAIApiKey ?? this.openAIApiKey;
        this.anthropicApiKey = data.anthropicApiKey ?? this.anthropicApiKey;
        this.enableTextToSpeech = data.enableTextToSpeech ?? this.enableTextToSpeech;
        
        if (!this.openAIApiKey) {
            await this.loadOpenAIApiKeyFromSmartComposer();
        }

        if (!this.anthropicApiKey) {
            await this.loadAnthropicApiKeyFromSmartComposer();
        }
    }

    async saveSettings() {
        await this.plugin.saveData({
            openAIApiKey: this.openAIApiKey,
            anthropicApiKey: this.anthropicApiKey,
            enableTextToSpeech: this.enableTextToSpeech
        });
    }

    /**
     * Attempts to load the OpenAI API key from the Smart Composer plugin data
     */
    async loadOpenAIApiKeyFromSmartComposer(): Promise<void> {
        try {
            const smartComposerDataPath = '.obsidian/plugins/smart-composer/data.json';
            const adapter = this.plugin.app.vault.adapter;
            
            if (await adapter.exists(smartComposerDataPath)) {
                const data = JSON.parse(await adapter.read(smartComposerDataPath));
                
                // Find the OpenAI provider
                const openAIProvider = data.providers.find((p: any) => p.type === 'openai' && p.id === 'openai');
                
                if (openAIProvider && openAIProvider.apiKey) {
                    this.openAIApiKey = openAIProvider.apiKey;
                    await this.saveSettings();
                    console.log('Loaded OpenAI API key from Smart Composer plugin');
                } else {
                    console.log('OpenAI API key not found in Smart Composer plugin data');
                }
            } else {
                console.log('Smart Composer plugin data not found');
            }
        } catch (error) {
            console.error('Error loading OpenAI API key from Smart Composer:', error);
        }
    }

    async loadAnthropicApiKeyFromSmartComposer(): Promise<void> {
        try {
            const smartComposerDataPath = '.obsidian/plugins/smart-composer/data.json';
            const adapter = this.plugin.app.vault.adapter;
            
            if (await adapter.exists(smartComposerDataPath)) {
                const data = JSON.parse(await adapter.read(smartComposerDataPath));
                
                // Find the Anthropic provider
                const anthropicProvider = data.providers.find((p: any) => p.type === 'anthropic' && p.id === 'anthropic');
                
                if (anthropicProvider && anthropicProvider.apiKey) {
                    this.anthropicApiKey = anthropicProvider.apiKey;
                    await this.saveSettings();
                    console.log('Loaded Anthropic API key from Smart Composer plugin');
                } else {
                    console.log('Anthropic API key not found in Smart Composer plugin data');
                }
            } else {
                console.log('Smart Composer plugin data not found');
            }
        } catch (error) {
            console.error('Error loading Anthropic API key from Smart Composer:', error);
        }
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