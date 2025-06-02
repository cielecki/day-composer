import MyPlugin from '../main';
import { App, PluginSettingTab, Setting, Notice, Modal } from 'obsidian';
import { getPluginSettings } from "./PluginSettings";
import { t } from '../i18n';

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	userToolsContainer: HTMLElement;
	secretsContainer: HTMLElement;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const {containerEl} = this;

		containerEl.empty();

		const settings = getPluginSettings();

		// API Keys & Secrets section header with add button
		const secretsHeaderContainer = containerEl.createEl('div', {
			attr: { style: 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 0;' }
		});
		
		secretsHeaderContainer.createEl('h2', {text: t('settings.secrets.title')});
		
		// Add new secret button - plain button, right-aligned
		const addSecretBtn = secretsHeaderContainer.createEl('button', {
			text: t('settings.secrets.addNew.button'),
			attr: { style: 'padding: 4px 12px; font-size: 13px;' }
		});
		addSecretBtn.addEventListener('click', () => {
			this.showAddSecretDialog();
		});

		// Description for secrets system
		const secretsDescEl = containerEl.createEl('div', { 
			cls: 'setting-item-description',
			attr: { style: 'margin-bottom: 1em; padding-top: 1em; color: var(--text-muted); border-top: 1px solid var(--background-modifier-border);' }
		});
		secretsDescEl.innerHTML = t('settings.secrets.description');

		// Container for secrets list
		this.secretsContainer = containerEl.createEl('div', {cls: 'secrets-container'});

		// Initial load of secrets display
		await this.refreshSecretsDisplay();

		// Security note for secrets
		const securityNoteEl = containerEl.createEl('div', { 
			cls: 'setting-item-description',
			attr: { style: 'margin-top: 1em; padding: 1em; background: var(--background-secondary); border-radius: 6px; color: var(--text-warning);' }
		});

		securityNoteEl.innerHTML = `<strong>⚠️ ${t('settings.security.title')}</strong><br>${t('settings.secrets.securityNote')}`;

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
		containerEl.createEl('h2', {text: t('settings.userTools.title'), attr: { style: 'margin: 0; margin-top: 2em; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 1em;' } });

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

	async refreshSecretsDisplay(): Promise<void> {
		this.secretsContainer.empty();

		const settings = getPluginSettings();
		const secretKeys = settings.getSecretKeys();

		if (secretKeys.length === 0) {
			const noSecretsMsg = this.secretsContainer.createEl('div', {
				cls: 'setting-item-description',
				attr: { style: 'margin-top: 1em; color: var(--text-muted); font-style: italic;' }
			});
			noSecretsMsg.textContent = t('settings.secrets.list.noSecrets');
			return;
		}

		// Display each secret with controls
		for (const key of secretKeys) {
			const value = settings.getSecret(key);
			
			const secretContainer = this.secretsContainer.createEl('div', {
				cls: 'setting-item',
				attr: { style: 'border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 12px; margin: 8px 0;' }
			});

			// Secret header with key name
			const secretHeader = secretContainer.createEl('div', {
				attr: { style: 'display: flex; flex-grow: 1; align-items: center; justify-content: space-between;' }
			});

			// Secret info on the left
			const secretInfo = secretHeader.createEl('div', {
				attr: { style: 'display: flex; align-items: center; gap: 8px;' }
			});

			// Secret name
			const nameEl = secretInfo.createEl('div');
			nameEl.createEl('strong', { 
				text: key,
			});

			// Controls on the right - moved to container level like user tools
			const controlsEl = secretContainer.createEl('div', {
				attr: { style: 'display: flex; gap: 8px; align-items: center; justify-content: flex-end;' }
			});

			// Edit button
			const editBtn = controlsEl.createEl('div', {
				cls: 'clickable-icon',
				attr: { 
					'aria-label': t('settings.secrets.list.edit'),
					'title': t('settings.secrets.list.edit')
				}
			});
			editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z"/></svg>`;
			editBtn.addEventListener('click', () => {
				this.showEditSecretDialog(key, value || '');
			});

			// Delete button
			const deleteBtn = controlsEl.createEl('div', {
				cls: 'clickable-icon',
				attr: { 
					'aria-label': t('settings.secrets.list.delete'),
					'title': t('settings.secrets.list.delete')
				}
			});
			deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c0 1 1 2 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
			deleteBtn.addEventListener('click', async () => {
				const confirmed = confirm(t('settings.secrets.list.confirmDelete', { key }));
				if (confirmed) {
					settings.removeSecret(key);
					await settings.saveSettings();
					await this.refreshSecretsDisplay();
					new Notice(t('settings.secrets.list.deleted', { key }));
				}
			});
		}
	}

	showAddSecretDialog(): void {
		const modal = new AddSecretModal(this.app, (key, value) => {
			const settings = getPluginSettings();
			settings.setSecret(key, value);
			settings.saveSettings();
			this.refreshSecretsDisplay();
		});
		modal.open();
	}

	showEditSecretDialog(key: string, currentValue: string): void {
		const modal = new EditSecretModal(this.app, key, currentValue, (value) => {
			const settings = getPluginSettings();
			settings.setSecret(key, value);
			settings.saveSettings();
			this.refreshSecretsDisplay();
		});
		modal.open();
	}

	async refreshUserToolsDisplay(): Promise<void> {
		this.userToolsContainer.empty();

		const settings = getPluginSettings();
		
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

class AddSecretModal extends Modal {
	private onResult: (key: string, value: string) => void;

	constructor(app: App, onResult: (key: string, value: string) => void) {
		super(app);
		this.onResult = onResult;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('secret-modal');

		const title = contentEl.createEl('h3', { text: t('settings.secrets.dialog.addTitle') });
		title.style.marginBottom = '16px';

		// Key input
		const keyLabel = contentEl.createEl('label', { text: t('settings.secrets.dialog.keyLabel') });
		keyLabel.style.cssText = 'display: block; margin-bottom: 4px; font-weight: bold;';

		const keyInput = contentEl.createEl('input', { type: 'text' });
		keyInput.placeholder = t('settings.secrets.dialog.keyPlaceholder');
		keyInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); box-sizing: border-box;';

		// Value input
		const valueLabel = contentEl.createEl('label', { text: t('settings.secrets.dialog.valueLabel') });
		valueLabel.style.cssText = 'display: block; margin-bottom: 4px; font-weight: bold;';

		const valueInput = contentEl.createEl('input', { type: 'text' });
		valueInput.placeholder = t('settings.secrets.dialog.valuePlaceholder');
		valueInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); box-sizing: border-box;';

		// Buttons
		const buttonsEl = contentEl.createEl('div');
		buttonsEl.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

		const cancelBtn = buttonsEl.createEl('button', { text: t('settings.secrets.dialog.cancel') });
		cancelBtn.onclick = () => this.close();

		const saveBtn = buttonsEl.createEl('button', { text: t('settings.secrets.dialog.save') });
		saveBtn.className = 'mod-cta';
		saveBtn.onclick = async () => {
			const key = keyInput.value.trim();
			const value = valueInput.value;

			if (!key) {
				new Notice(t('settings.secrets.dialog.errors.emptyKey'));
				return;
			}

			const settings = getPluginSettings();
			if (settings.getSecret(key)) {
				const confirmed = confirm(t('settings.secrets.dialog.errors.keyExists', { key }));
				if (!confirmed) return;
			}

			this.onResult(key, value);
			this.close();
		};

		// Focus the first input
		setTimeout(() => keyInput.focus(), 10);

		// Handle Enter key on inputs
		const handleEnter = (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				saveBtn.click();
			}
		};
		keyInput.addEventListener('keydown', handleEnter);
		valueInput.addEventListener('keydown', handleEnter);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class EditSecretModal extends Modal {
	private key: string;
	private currentValue: string;
	private onResult: (value: string) => void;

	constructor(app: App, key: string, currentValue: string, onResult: (value: string) => void) {
		super(app);
		this.key = key;
		this.currentValue = currentValue;
		this.onResult = onResult;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('secret-modal');

		const title = contentEl.createEl('h3', { text: t('settings.secrets.dialog.editTitle', { key: this.key }) });
		title.style.marginBottom = '16px';

		// Value input
		const valueLabel = contentEl.createEl('label', { text: t('settings.secrets.dialog.valueLabel') });
		valueLabel.style.cssText = 'display: block; margin-bottom: 4px; font-weight: bold;';

		const valueInput = contentEl.createEl('input', { type: 'text' });
		valueInput.value = this.currentValue;
		valueInput.placeholder = t('settings.secrets.dialog.valuePlaceholder');
		valueInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); box-sizing: border-box;';

		// Buttons
		const buttonsEl = contentEl.createEl('div');
		buttonsEl.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

		const cancelBtn = buttonsEl.createEl('button', { text: t('settings.secrets.dialog.cancel') });
		cancelBtn.onclick = () => this.close();

		const saveBtn = buttonsEl.createEl('button', { text: t('settings.secrets.dialog.save') });
		saveBtn.className = 'mod-cta';
		saveBtn.onclick = async () => {
			this.onResult(valueInput.value);
			this.close();
		};

		// Focus and select the input
		setTimeout(() => {
			valueInput.focus();
			valueInput.select();
		}, 10);

		// Handle Enter key
		valueInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				saveBtn.click();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
