import MyPlugin from '../main';
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { getPluginSettings } from "./PluginSettings";
import { t } from '../i18n';

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	userToolsContainer: HTMLElement;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const {containerEl} = this;

		containerEl.empty();

		const settings = getPluginSettings();

		// API Keys section
		containerEl.createEl('h2', {text: t('settings.apiKeys.title')});

		// Anthropic API Key setting
		new Setting(containerEl)
			.setName(t('settings.apiKeys.anthropic'))
			.addText(text => {
				text.setPlaceholder(t('settings.apiKeys.enterAnthropicKey'))
					.setValue(settings.anthropicApiKey)
					.onChange(async (value) => {
						settings.anthropicApiKey = value;
						await settings.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		// Set HTML description to enable the link
		const anthropicDesc = containerEl.querySelector('.setting-item:last-child .setting-item-description') as HTMLElement;
		if (anthropicDesc) {
			anthropicDesc.innerHTML = t('settings.apiKeys.anthropicDesc');
		}

		// OpenAI API Key setting
		new Setting(containerEl)
			.setName(t('settings.apiKeys.openai'))
			.addText(text => {
				text.setPlaceholder(t('settings.apiKeys.enterOpenAIKey'))
					.setValue(settings.openAIApiKey)
					.onChange(async (value) => {
						settings.openAIApiKey = value;
						await settings.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		// Set HTML description to enable the link
		const openaiDesc = containerEl.querySelector('.setting-item:last-child .setting-item-description') as HTMLElement;
		if (openaiDesc) {
			openaiDesc.innerHTML = t('settings.apiKeys.openaiDesc');
		}

		// Firecrawl API Key setting
		new Setting(containerEl)
			.setName(t('settings.apiKeys.firecrawl'))
			.addText(text => {
				text.setPlaceholder(t('settings.apiKeys.enterFirecrawlKey'))
					.setValue(settings.firecrawlApiKey)
					.onChange(async (value) => {
						settings.firecrawlApiKey = value;
						await settings.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		// Set HTML description to enable the link
		const firecrawlDesc = containerEl.querySelector('.setting-item:last-child .setting-item-description') as HTMLElement;
		if (firecrawlDesc) {
			firecrawlDesc.innerHTML = t('settings.apiKeys.firecrawlDesc');
		}

		// Security note for API keys
		const securityNoteEl = containerEl.createEl('div', { 
			cls: 'setting-item-description',
			attr: { style: 'margin-top: 2em; padding: 1em; background: var(--background-secondary); border-radius: 6px; color: var(--text-warning);' }
		});

		securityNoteEl.innerHTML = `<strong>⚠️ ${t('settings.security.title')}</strong><br>${t('settings.apiKeys.securityNote')}`;

		// Life Navigator Actions section
		containerEl.createEl('h2', {text: t('settings.actions.title'), attr: { style: 'margin-top: 2em;' } });

		// Create Starter Kit button
		new Setting(containerEl)
			.setName(t('settings.actions.createStarterKit.name'))
			.setDesc(t('settings.actions.createStarterKit.desc'))
			.addButton(button => button
				.setButtonText(t('settings.actions.createStarterKit.button'))
				.onClick(async () => {
					// Get current plugin instance
					const plugin = (this.app as any).plugins.plugins['life-navigator'] as MyPlugin;
					if (plugin) {
						button.setDisabled(true);
						button.setButtonText(t('ui.setup.saving'));
						try {
							// Execute the create starter kit command
							if (this.app && (this.app as any).commands) {
								// @ts-ignore - Access Obsidian's commands API
								await (this.app as any).commands.executeCommandById('life-navigator:create-starter-kit');
							}
						} catch (error) {
							console.error('Error creating starter kit:', error);
						} finally {
							button.setDisabled(false);
							button.setButtonText(t('settings.actions.createStarterKit.button'));
						}
					}
				}));

		// Check for updates button
		new Setting(containerEl)
			.setName(t('settings.actions.checkUpdates.name'))
			.setDesc(t('settings.actions.checkUpdates.desc'))
			.addButton(button => button
				.setButtonText(t('settings.actions.checkUpdates.button'))
				.onClick(async () => {
					button.setDisabled(true);
					button.setButtonText(t('ui.setup.saving'));
					
					try {
						// Execute the check for updates command
						if (this.app && (this.app as any).commands) {
							// @ts-ignore - Access Obsidian's commands API
							await (this.app as any).commands.executeCommandById('life-navigator:check-for-updates');
						}
					} catch (error) {
						console.error('Error checking for updates:', error);
					} finally {
						button.setDisabled(false);
						button.setButtonText(t('settings.actions.checkUpdates.button'));
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
						new Notice(t('settings.actions.resetTutorial.error', { error: error.message }));
					} finally {
						button.setDisabled(false);
						button.setButtonText(t('settings.actions.resetTutorial.button'));
					}
				}));

		// Advanced section
		containerEl.createEl('h2', {text: t('settings.advanced.title'), attr: { style: 'margin-top: 2em;' } });

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

		// User-Defined Tools section (moved to bottom)
		containerEl.createEl('h2', {text: t('settings.userTools.title'), attr: { style: 'margin-top: 2em;' } });

		// User-defined tools toggle
		const userToolsSetting = new Setting(containerEl)
			.setName(t('settings.userTools.enabled.name'))
			.setDesc(t('settings.userTools.enabled.desc'))
			.addToggle(toggle => toggle
				.setValue(settings.userDefinedToolsEnabled)
				.onChange(async (value) => {
					if (value) {
						// Show security warning when enabling
						const confirmed = confirm(t('settings.userTools.securityWarning'));
						if (!confirmed) {
							toggle.setValue(false);
							return;
						}
					}
					settings.userDefinedToolsEnabled = value;
					await settings.saveSettings();
					
					// Refresh the tools display
					await this.refreshUserToolsDisplay();
					
					// Initialize or cleanup user tools manager
					if (value && this.plugin.userToolManager) {
						await this.plugin.userToolManager.initialize();
					}
				}));

		// Container for discovered tools (will be populated dynamically)
		this.userToolsContainer = containerEl.createEl('div', {cls: 'user-tools-container'});
		
		// Initial load of tools display
		await this.refreshUserToolsDisplay();

		// Add security warning box with standardized styling (below tools list)
		const securityWarningEl = containerEl.createEl('div', { 
			cls: 'setting-item-description',
			attr: { style: 'margin-top: 1em; padding: 1em; background: var(--background-secondary); border-radius: 6px; color: var(--text-warning);' }
		});
		securityWarningEl.innerHTML = `<strong>⚠️ ${t('settings.userTools.security.title')}</strong><br>${t('settings.userTools.security.warning')}`;
	}

	async refreshUserToolsDisplay(): Promise<void> {
		this.userToolsContainer.empty();

		const settings = getPluginSettings();
		
		// If user-defined tools are disabled, show message
		if (!settings.userDefinedToolsEnabled) {
			const disabledMsg = this.userToolsContainer.createEl('div', {
				cls: 'setting-item-description',
				attr: { style: 'margin-top: 1em; color: var(--text-muted); font-style: italic;' }
			});
			disabledMsg.textContent = t('settings.userTools.list.disabled');
			return;
		}

		// If no user tools manager, show error
		if (!this.plugin.userToolManager) {
			const errorMsg = this.userToolsContainer.createEl('div', {
				cls: 'setting-item-description',
				attr: { style: 'margin-top: 1em; color: var(--text-error);' }
			});
			errorMsg.textContent = t('settings.userTools.list.noManager');
			return;
		}

		// Refresh tools and get current list
		await this.plugin.userToolManager.refreshTools();
		const tools = this.plugin.userToolManager.getTools();

		if (tools.length === 0) {
			const noToolsMsg = this.userToolsContainer.createEl('div', {
				cls: 'setting-item-description',
				attr: { style: 'margin-top: 1em; color: var(--text-muted); font-style: italic;' }
			});
			noToolsMsg.innerHTML = t('settings.userTools.list.noTools');
			return;
		}

		// Display each tool with status and controls
		for (const tool of tools) {
			const status = this.plugin.userToolManager.getToolStatus(tool);
			
			const toolContainer = this.userToolsContainer.createEl('div', {
				cls: 'setting-item',
				attr: { style: 'border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 12px; margin: 8px 0;' }
			});

			// Tool header with icon and name
			const toolHeader = toolContainer.createEl('div', {
				attr: { style: 'display: flex; flex-grow: 1; align-items: center; justify-content: space-between; margin-bottom: 8px;' }
			});

			const toolInfo = toolHeader.createEl('div', {
				attr: { style: 'display: flex; align-items: center; gap: 8px;' }
			});

			// Tool icon (using CSS icons or emoji fallback)
			const iconEl = toolInfo.createEl('span', {
				text: '🔧', // fallback
				attr: { 
					style: `font-size: 16px; ${tool.iconColor ? `color: ${tool.iconColor};` : ''}`,
					title: `Icon: ${tool.icon}`
				}
			});

			// Try to use Lucide icon if available
			if (tool.icon && tool.icon !== 'gear') {
				iconEl.textContent = '';
				iconEl.addClass(`lucide-${tool.icon}`);
			}

			// Tool name and description (clickable to open file)
			const nameEl = toolInfo.createEl('div', {
				attr: { 
					style: 'cursor: pointer;',
					title: t('settings.userTools.list.tooltips.clickToOpen')
				}
			});
			nameEl.createEl('strong', { 
				text: tool.name,
				attr: { style: 'color: var(--interactive-accent);' }
			});
			if (tool.description) {
				nameEl.createEl('div', { 
					text: tool.description,
					cls: 'setting-item-description',
					attr: { style: 'color: var(--text-muted);' }
				});
			}

			// Make name/description clickable to open file
			nameEl.addEventListener('click', async () => {
				try {
					// Close the settings modal first
					const settingsModal = document.querySelector('.modal-container');
					if (settingsModal) {
						// Find and click the close button or trigger close
						const closeBtn = settingsModal.querySelector('.modal-close-button') as HTMLElement;
						if (closeBtn) {
							closeBtn.click();
						} else {
							// Fallback: remove modal manually
							settingsModal.remove();
						}
					}

					// Small delay to ensure modal is closed before opening file
					setTimeout(async () => {
						// Open the tool file in Obsidian
						const file = this.app.vault.getAbstractFileByPath(tool.filePath);
						if (file) {
							await this.app.workspace.openLinkText(tool.filePath, '', true);
						}
					}, 100);
				} catch (error) {
					console.error('Error opening tool file:', error);
				}
			});

			// Controls - only approval management
			const controlsEl = toolContainer.createEl('div', {
				attr: { style: 'display: flex; gap: 8px; align-items: center; margin-top: 8px;' }
			});

			// Approve/Revoke button
			const approvalBtn = controlsEl.createEl('button', {
				text: status.approved && !status.codeChanged ? 
					t('settings.userTools.list.controls.revoke') : 
					t('settings.userTools.list.controls.approve'),
				attr: { 
					style: `padding: 4px 8px; font-size: 12px; ${
						status.approved && !status.codeChanged ? 
						'background: var(--color-red); color: white;' : 
						'background: var(--interactive-accent); color: white;'
					}`
				}
			});

			approvalBtn.addEventListener('click', async () => {
				try {
					if (status.approved && !status.codeChanged) {
						// Revoke approval
						this.plugin.userToolManager!.revokeToolApproval(tool.filePath);
						await this.refreshUserToolsDisplay();
					} else {
						// Request approval
						const approved = await this.plugin.userToolManager!.approveToolFromSettings(tool.filePath);
						if (approved) {
							await this.refreshUserToolsDisplay();
						}
					}
				} catch (error) {
					console.error('Error managing approval:', error);
				}
			});
		}
	}
}
