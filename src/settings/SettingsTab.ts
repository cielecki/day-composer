import MyPlugin from '../main';
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
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

		// API Keys section
		containerEl.createEl('h2', {text: t('settings.apiKeys.title')});
		
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

		// Add a note about API key security
		const securityNoteEl = containerEl.createEl('div', { 
			cls: 'setting-item-description',
			attr: { style: 'margin-top: 2em; padding: 1em; background: var(--background-secondary); border-radius: 6px; color: var(--text-warning);' }
		});
		securityNoteEl.innerHTML = `<strong>${t('settings.security.title')}</strong><br>${t('settings.apiKeys.securityNote')}`;

		// Advanced section
		containerEl.createEl('h2', {text: t('settings.advanced.title')});

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

		// Add Life Navigator Actions section at the bottom
		containerEl.createEl('h2', {text: t('settings.actions.title')});
		
		// Check for updates button
		new Setting(containerEl)
			.setName(t('settings.actions.checkUpdates.name'))
			.setDesc(t('settings.actions.checkUpdates.desc'))
			.addButton(button => button
				.setButtonText(t('settings.actions.checkUpdates.button'))
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					button.setButtonText(t('messages.checkingForUpdates'));
					
					try {
						// Execute the check for updates command
						if (this.app && (this.app as any).commands) {
							// @ts-ignore - Access Obsidian's commands API
							await (this.app as any).commands.executeCommandById('life-navigator:check-for-updates');
						}
					} catch (error) {
						console.error('Error checking for updates:', error);
						new Notice(t('errors.failedToUpdatePlugin').replace('{{error}}', error.message));
					} finally {
						button.setDisabled(false);
						button.setButtonText(t('settings.actions.checkUpdates.button'));
					}
				}));

		// Create starter kit button
		new Setting(containerEl)
			.setName(t('settings.actions.createStarterKit.name'))
			.setDesc(t('settings.actions.createStarterKit.desc'))
			.addButton(button => button
				.setButtonText(t('settings.actions.createStarterKit.button'))
				.onClick(async () => {
					button.setDisabled(true);
					button.setButtonText(t('messages.creatingStarterKit'));
					
					try {
						// Execute the create starter kit command
						if (this.app && (this.app as any).commands) {
							// @ts-ignore - Access Obsidian's commands API
							await (this.app as any).commands.executeCommandById('life-navigator:create-starter-kit');
							new Notice(t('ui.starterKit.createdSuccess'));
						}
					} catch (error) {
						console.error('Error creating starter kit:', error);
						new Notice(t('ui.starterKit.createdError').replace('{{error}}', error.message));
					} finally {
						button.setDisabled(false);
						button.setButtonText(t('settings.actions.createStarterKit.button'));
					}
				}));

		// View documentation button
		new Setting(containerEl)
			.setName(t('settings.actions.viewDocs.name'))
			.setDesc(t('settings.actions.viewDocs.desc'))
			.addButton(button => button
				.setButtonText(t('settings.actions.viewDocs.button'))
				.onClick(() => {
					// Open GitHub documentation in default browser
					window.open('https://github.com/cielecki/life-navigator/blob/main/docs/user-guide.md', '_blank');
				}));

		// Reset tutorial button
		new Setting(containerEl)
			.setName(t('settings.actions.resetTutorial.name'))
			.setDesc(t('settings.actions.resetTutorial.desc'))
			.addButton(button => button
				.setButtonText(t('settings.actions.resetTutorial.button'))
				.onClick(async () => {
					const confirmed = confirm(t('settings.actions.resetTutorial.confirm'));
					if (!confirmed) return;

					button.setDisabled(true);
					button.setButtonText(t('ui.setup.saving'));
					
					try {
						// Execute the reset tutorial command
						if (this.app && (this.app as any).commands) {
							// @ts-ignore - Access Obsidian's commands API
							await (this.app as any).commands.executeCommandById('life-navigator:reset-tutorial');
						}
					} catch (error) {
						console.error('Error resetting tutorial:', error);
						new Notice(t('settings.actions.resetTutorial.error').replace('{{error}}', error.message));
					} finally {
						button.setDisabled(false);
						button.setButtonText(t('settings.actions.resetTutorial.button'));
					}
				}));
		
	}
}
