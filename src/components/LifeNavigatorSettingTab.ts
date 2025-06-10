import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { App, PluginSettingTab, Setting, Notice, Modal, getIcon } from 'obsidian';
import { getStore } from '../store/plugin-store';
import { t } from 'src/i18n';

export class LifeNavigatorSettingTab extends PluginSettingTab {
	plugin: LifeNavigatorPlugin;
	userToolsContainer: HTMLElement;
	secretsContainer: HTMLElement;

	constructor(app: App, plugin: LifeNavigatorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const {containerEl} = this;

		containerEl.empty();

		const store = getStore();

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
		secretsDescEl.textContent = t('settings.secrets.description');

		// Container for secrets list
		this.secretsContainer = containerEl.createEl('div', {cls: 'secrets-container'});

		// Initial load of secrets display
		await this.refreshSecretsDisplay();

		// Security note for secrets
		const securityNoteEl = containerEl.createEl('div', { 
			cls: 'setting-item-description',
			attr: { style: 'margin-top: 1em; padding: 1em; background: var(--background-secondary); border-radius: 6px; color: var(--text-warning);' }
		});

		const warningTitle = securityNoteEl.createEl('strong');
		warningTitle.textContent = '⚠️ ' + t('settings.security.title');
		securityNoteEl.createEl('br');
		securityNoteEl.appendText(t('settings.secrets.securityNote'));

		// === LIFE NAVIGATOR ACTIONS ===
		containerEl.createEl('h2', { text: t('settings.actions.title') });

		// Check Updates button
		new Setting(containerEl)
			.setName(t('settings.actions.checkUpdates.name'))
			.setDesc(t('settings.actions.checkUpdates.desc'))
			.addButton(button => {
				button
					.setButtonText(t('settings.actions.checkUpdates.button'))
					.onClick(async () => {
						button.setButtonText('Checking...');
						button.setDisabled(true);

						try {
							// Execute the check for updates command
							// @ts-ignore
							await (this.app as any).commands.executeCommandById('life-navigator:check-for-updates');
						} catch (error) {
							console.error('Error checking for updates:', error);
						} finally {
							button.setButtonText(t('settings.actions.checkUpdates.button'));
							button.setDisabled(false);
						}
					});
			});

		// Reset Tutorial button
		new Setting(containerEl)
			.setName(t('settings.actions.resetTutorial.name'))
			.setDesc(t('settings.actions.resetTutorial.desc'))
			.addButton(button => {
				button
					.setButtonText(t('settings.actions.resetTutorial.button'))
					.onClick(async () => {
						button.setButtonText('Resetting...');
						button.setDisabled(true);

						try {
							// Execute the reset tutorial command
							// @ts-ignore
							await (this.app as any).commands.executeCommandById('life-navigator:reset-tutorial');
						} catch (error) {
							console.error('Error resetting tutorial:', error);
						} finally {
							button.setButtonText(t('settings.actions.resetTutorial.button'));
							button.setDisabled(false);
						}
					});
			});

		// Advanced section
		containerEl.createEl('h2', {text: t('settings.advanced.title'), attr: { style: 'margin-top: 2em;' } });

		// Speech-to-text Prompt setting
		const promptDesc = new Setting(containerEl)
			.setName(t('settings.prompts.speechToTextPrompt'))
			.addTextArea(text => {
				text.setPlaceholder(t('settings.prompts.defaultPrompt'))
					.setValue(store.settings.speechToTextPrompt || '')
					.onChange(async (value) => {
						store.updateSettings({ speechToTextPrompt: value });
						await store.saveSettings();
					});
				text.inputEl.rows = 7;
				text.inputEl.cols = 50;
			});
		
		// Set description text
		promptDesc.descEl.textContent = t('settings.prompts.speechToTextPromptDesc');

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
		const userToolsWarningTitle = securityWarningEl.createEl('strong');
		userToolsWarningTitle.textContent = '⚠️ ' + t('settings.userTools.security.title');
		securityWarningEl.createEl('br');
		securityWarningEl.appendText(t('settings.userTools.security.warning'));


	}

	async refreshSecretsDisplay(): Promise<void> {
		this.secretsContainer.empty();

		const store = getStore();
		const secretKeys = Object.keys(store.settings.secrets);

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
			const value = store.settings.secrets[key];
			
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
			const editIcon = getIcon('edit');
			if (editIcon) {
				editBtn.appendChild(editIcon);
			}
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
			const deleteIcon = getIcon('trash-2');
			if (deleteIcon) {
				deleteBtn.appendChild(deleteIcon);
			}
			deleteBtn.addEventListener('click', async () => {
				const confirmed = confirm(t('settings.secrets.list.confirmDelete', { key }));
				if (confirmed) {
					const store = getStore();
					await store.removeSecret(key);
					
					// Reset tutorial state if relevant API keys are deleted
					if (key === 'OPENAI_API_KEY') {
						// Reset the skipped flag when OpenAI key is deleted
						store.updateSettings({
							tutorial: {
								...store.settings.tutorial,
								openaiKeySkipped: false
							}
						});
					}
				
				await store.saveSettings();
					await this.refreshSecretsDisplay();
					new Notice(t('settings.secrets.list.deleted', { key }));
				}
			});
		}
	}

	showAddSecretDialog(): void {
		const modal = new AddSecretModal(this.app, async (key, value) => {
			const store = getStore();
			await store.setSecret(key, value);
			
			await store.saveSettings();
			await this.refreshSecretsDisplay();
		});
		modal.open();
	}

	showEditSecretDialog(key: string, currentValue: string): void {
		const modal = new EditSecretModal(this.app, key, currentValue, async (value) => {
			const store = getStore();
			await store.setSecret(key, value);
			await store.saveSettings();
			await this.refreshSecretsDisplay();
		});
		modal.open();
	}

	async refreshUserToolsDisplay(): Promise<void> {
		this.userToolsContainer.empty();
		
		// Check for validation issues and show fix button if needed - MOVED ABOVE TOOLS LIST
		const store = getStore();
		const invalidTools = store.validation.invalidTools;
		
		if (invalidTools.length > 0) {
			// Create validation section with standard styling - ABOVE the tools list
			const validationSection = this.userToolsContainer.createEl('div', {
				cls: 'setting-item-description',
				attr: { 
					style: 'margin-bottom: 16px; padding: 12px; background: var(--background-secondary); border-radius: 6px; border-left: 3px solid var(--color-orange);' 
				}
			});
			
			// Horizontal layout: message on left, button on right
			const validationContent = validationSection.createEl('div', {
				attr: { style: 'display: flex; align-items: center; justify-content: space-between; gap: 12px;' }
			});
			
			// Left side: warning message
			const messageSection = validationContent.createEl('div', {
				attr: { style: 'display: flex; align-items: center; gap: 8px; flex: 1;' }
			});
			
			messageSection.createEl('span', { text: '⚠️' });
			
			const toolIssuesFound = invalidTools.length === 1 ? t('validation.toolIssuesFound.singular', {
				count: invalidTools.length,
			}) : (invalidTools.length >= 2 && invalidTools.length <= 4 ? t('validation.toolIssuesFound.few', {
				count: invalidTools.length,
			}) : t('validation.toolIssuesFound.many', {
				count: invalidTools.length,
			}));
			
			messageSection.createEl('span', { 
				text: toolIssuesFound,
				attr: { style: 'color: var(--text-normal);' }
			});
			
			// Right side: fix button
			const fixToolsButton = invalidTools.length === 1 ? t('validation.fixTools.buttonSettings.singular', {
				count: invalidTools.length,
			}) : (invalidTools.length >= 2 && invalidTools.length <= 4 ? t('validation.fixTools.buttonSettings.few', {
				count: invalidTools.length,
			}) : t('validation.fixTools.buttonSettings.many', {
				count: invalidTools.length,
			}));
			
			const fixBtn = validationContent.createEl('button', {
				text: fixToolsButton,
				attr: { 
					style: 'padding: 6px 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 4px; cursor: pointer; flex-shrink: 0;'
				}
			});
			
			// Add wrench emoji before text
			fixBtn.prepend('🔧 ');
			
			fixBtn.addEventListener('click', () => {
				// Close settings by navigating away (Obsidian will close settings tab)
				store.setActiveModeWithPersistence(':prebuilt:guide');
				// Format file paths nicely - show first 5 and indicate if there are more
				const toolPathsFormatted = invalidTools.length <= 5 
					? invalidTools.join(', ')
					: `${invalidTools.slice(0, 5).join(', ')} and ${invalidTools.length - 5} more`;

				const fixToolsMessage = invalidTools.length === 1 ? t('validation.fixTools.message.singular', {
					filePaths: toolPathsFormatted,
				}) : (invalidTools.length >= 2 && invalidTools.length <= 4 ? t('validation.fixTools.message.few', {
					filePaths: toolPathsFormatted,
				}) : t('validation.fixTools.message.many', {
					filePaths: toolPathsFormatted,
				}));

				store.addUserMessage(fixToolsMessage);
				
				// Close settings tab by navigating to main view
				this.app.workspace.getLeaf().detach();
			});
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
			noToolsMsg.textContent = t('settings.userTools.list.noTools');
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
				attr: { style: 'display: flex; flex-grow: 1; align-items: center; justify-content: space-between;' }
			});

			const toolInfo = toolHeader.createEl('div', {
				attr: { 
					style: 'display: flex; flex-direction: column; gap: 4px; cursor: pointer; width: 100%;', 
					title: t('settings.userTools.list.tooltips.clickToOpen') 
				}
			});

			// First row: icon + tool name
			const titleRowEl = toolInfo.createEl('div', {
				attr: { style: 'display: flex; align-items: center; gap: 8px;' }
			});

			// Tool icon (using Obsidian's getIcon function)
			const iconEl = titleRowEl.createEl('span', {
				attr: { 
					style: `display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0;`,
					title: `Icon: ${tool.icon}`
				}
			});

			// Use Obsidian's getIcon function for proper icon rendering
			if (tool.icon) {
				const iconSvg = getIcon(tool.icon);
				if (iconSvg) {
					iconEl.appendChild(iconSvg);
				} else {
					// Fallback to emoji if icon not found
					iconEl.textContent = '🔧';
				}
			} else {
				iconEl.textContent = '🔧';
			}

			// Tool name
			titleRowEl.createEl('strong', { 
				text: tool.name,
			});

			// Tool description (separate row, aligned with icon)
			if (tool.description) {
				toolInfo.createEl('div', { 
					text: tool.description,
					cls: 'setting-item-description',
					attr: { style: 'color: var(--text-muted);' }
				});
			}

			// Make entire tool info section clickable to open file
			toolInfo.addEventListener('click', async () => {
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
						'background: var(--background-secondary); color: var(--text-normal);' : 
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
	private onResult: (key: string, value: string) => Promise<void>;

	constructor(app: App, onResult: (key: string, value: string) => Promise<void>) {
		super(app);
		this.onResult = onResult;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('secret-modal');

		const title = contentEl.createEl('h3', { text: t('settings.secrets.dialog.addTitle') });
		title.className = 'ln-form-title';

		// Key input
		const keyLabel = contentEl.createEl('label', { text: t('settings.secrets.dialog.keyLabel') });
		keyLabel.className = 'ln-form-label';

		const keyInput = contentEl.createEl('input', { type: 'text' });
		keyInput.placeholder = t('settings.secrets.dialog.keyPlaceholder');
		keyInput.className = 'ln-form-input';

		// Value input
		const valueLabel = contentEl.createEl('label', { text: t('settings.secrets.dialog.valueLabel') });
		valueLabel.className = 'ln-form-label';

		const valueInput = contentEl.createEl('input', { type: 'text' });
		valueInput.placeholder = t('settings.secrets.dialog.valuePlaceholder');
		valueInput.className = 'ln-form-input';

		// Buttons
		const buttonsEl = contentEl.createEl('div');
		buttonsEl.className = 'ln-form-buttons';

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

			const store = getStore();
			if (store.settings.secrets[key]) {
				const confirmed = confirm(t('settings.secrets.dialog.errors.keyExists', { key }));
				if (!confirmed) return;
			}

			try {
				await this.onResult(key, value);
				this.close();
			} catch (error) {
				console.error('Error saving secret:', error);
				new Notice('Error saving secret');
			}
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
	private onResult: (value: string) => Promise<void>;

	constructor(app: App, key: string, currentValue: string, onResult: (value: string) => Promise<void>) {
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
		title.className = 'ln-form-title';

		// Value input
		const valueLabel = contentEl.createEl('label', { text: t('settings.secrets.dialog.valueLabel') });
		valueLabel.className = 'ln-form-label';

		const valueInput = contentEl.createEl('input', { type: 'text' });
		valueInput.value = this.currentValue;
		valueInput.placeholder = t('settings.secrets.dialog.valuePlaceholder');
		valueInput.className = 'ln-form-input';

		// Buttons
		const buttonsEl = contentEl.createEl('div');
		buttonsEl.className = 'ln-form-buttons';

		const cancelBtn = buttonsEl.createEl('button', { text: t('settings.secrets.dialog.cancel') });
		cancelBtn.onclick = () => this.close();

		const saveBtn = buttonsEl.createEl('button', { text: t('settings.secrets.dialog.save') });
		saveBtn.className = 'mod-cta';
		saveBtn.onclick = async () => {
			try {
				await this.onResult(valueInput.value);
				this.close();
			} catch (error) {
				console.error('Error saving secret:', error);
				new Notice('Error saving secret');
			}
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
