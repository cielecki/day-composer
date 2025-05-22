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
		const settings = getPluginSettings();

		containerEl.empty();
		
		// Anthropic API Key setting
		const anthropicSetting = new Setting(containerEl)
			.setName(t('settings.apiKeys.anthropic'))
			.addText(text => text
				.setPlaceholder(t('settings.apiKeys.enterAnthropicKey'))
				.setValue(settings.anthropicApiKey)
				.onChange(async (value) => {
					settings.anthropicApiKey = value;
					await settings.saveSettings();
				}));
		
		// Set HTML description to enable the link
		anthropicSetting.descEl.innerHTML = t('settings.apiKeys.anthropicDesc');
		
		// OpenAI API Key setting
		const openAISetting = new Setting(containerEl)
			.setName(t('settings.apiKeys.openai'))
			.addText(text => text
				.setPlaceholder(t('settings.apiKeys.enterOpenAIKey'))
				.setValue(settings.openAIApiKey)
				.onChange(async (value) => {
					settings.openAIApiKey = value;
					await settings.saveSettings();
				}));

		// Set HTML description to enable the link
		openAISetting.descEl.innerHTML = t('settings.apiKeys.openaiDesc');

		// Speech-to-text Prompt setting
		const promptDesc = new Setting(containerEl)
			.setName(t('settings.prompts.speechToTextPrompt'))
			.addTextArea(text => {
				text.setPlaceholder(t('settings.prompts.defaultPrompt'))
					.setValue(settings.speechToTextPrompt || '')
					.onChange(async (value) => {
						settings.speechToTextPrompt = value;
						await settings.saveSettings();
					});
				text.inputEl.rows = 7;
				text.inputEl.cols = 50;
			});
		
		// Set HTML description to enable the link
		promptDesc.descEl.innerHTML = t('settings.prompts.speechToTextPromptDesc');

		// Add a note about API key security
		const securityNoteEl = containerEl.createEl('div', { 
			cls: 'setting-item-description',
			attr: { style: 'margin-bottom: 1em; color: var(--text-warning);' }
		});
		securityNoteEl.innerHTML = t('settings.apiKeys.securityNote');
		
	}
}
