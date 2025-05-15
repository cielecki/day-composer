import MyPlugin from '../main';
import { App, PluginSettingTab, Setting } from 'obsidian';
import { getPluginSettings } from "./PluginSettings";
import { t } from '../i18n';

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		
		// Text-to-Speech Settings Section
		containerEl.createEl('h3', { text: t('settings.tts.title') });
		
		// Anthropic API Key setting
		new Setting(containerEl)
			.setName(t('settings.apiKeys.anthropic'))
			.setDesc(t('settings.apiKeys.anthropicDesc'))
			.addText(text => text
				.setPlaceholder(t('settings.apiKeys.enterAnthropicKey'))
				.setValue(getPluginSettings().anthropicApiKey)
				.onChange(async (value) => {
					getPluginSettings().anthropicApiKey = value;
					await getPluginSettings().saveSettings();
				}));
		
		// OpenAI API Key setting
		new Setting(containerEl)
			.setName(t('settings.apiKeys.openai'))
			.setDesc(t('settings.apiKeys.openaiDesc'))
			.addText(text => text
				.setPlaceholder(t('settings.apiKeys.enterOpenAIKey'))
				.setValue(getPluginSettings().openAIApiKey)
				.onChange(async (value) => {
					getPluginSettings().openAIApiKey = value;
					await getPluginSettings().saveSettings();
				}))
			.addButton(button => button
				.setButtonText(t('settings.apiKeys.loadFromSmartComposer'))
				.onClick(async () => {
					await getPluginSettings().loadOpenAIApiKeyFromSmartComposer();
					// Update the display after loading
					this.display();
				}));
		
		// Enable Text-to-Speech toggle
		new Setting(containerEl)
			.setName(t('settings.tts.enable'))
			.setDesc(t('settings.tts.enableDesc'))
			.addToggle(toggle => toggle
				.setValue(getPluginSettings().enableTextToSpeech)
				.onChange(async (value) => {
					getPluginSettings().enableTextToSpeech = value;
					await getPluginSettings().saveSettings();
				}));

		// Add a note about API key security
		const securityNoteEl = containerEl.createEl('div', { 
			cls: 'setting-item-description',
			attr: { style: 'margin-bottom: 1em; color: var(--text-warning);' }
		});
		securityNoteEl.innerHTML = t('settings.apiKeys.securityNote');
	}
}
