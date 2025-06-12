import { Plugin, Notice, requestUrl, WorkspaceLeaf, MarkdownView } from 'obsidian';
import { ConfirmReloadModal } from './components/ConfirmReloadModal';
import { initI18n, t } from './i18n';
import { LifeNavigatorView, LIFE_NAVIGATOR_VIEW_TYPE } from './views/life-navigator-view';
import { CostAnalysisView, COST_ANALYSIS_VIEW_TYPE } from './views/cost-analysis-view';
import { SystemPromptView, SYSTEM_PROMPT_VIEW_TYPE, SystemPromptViewState } from './views/system-prompt-view';
import { checkForAvailableUpdate, checkForUpdatesOnStartup } from './utils/auto-update/auto-update';
import { getObsidianTools, resetObsidianTools } from './obsidian-tools';
import { LifeNavigatorSettingTab } from './components/LifeNavigatorSettingTab';
import { UserDefinedToolManager } from './services/UserDefinedToolManager';
import { cleanupStore, initializeStore } from './store/store-initialization';
import { usePluginStore, getStore } from './store/plugin-store';

export class LifeNavigatorPlugin extends Plugin {
	private static _instance: LifeNavigatorPlugin | null = null;

	userToolManager: UserDefinedToolManager | null = null;
	private setupChangeSubscription: (() => void) | null = null;

	static getInstance(): LifeNavigatorPlugin {
		if (!LifeNavigatorPlugin._instance) {
			throw new Error('LifeNavigatorPlugin instance not found');
		}

		return LifeNavigatorPlugin._instance;
	}

	/**
	 * Opens a view with standard Obsidian behavior that mimics how files are opened.
	 * This includes:
	 * - Reusing existing instances when appropriate
	 * - Using current tab if it's empty or should be replaced
	 * - Creating new tabs when current tab has content that shouldn't be replaced
	 * - Respecting user's tab behavior preferences
	 * 
	 * @param viewType The type of view to open
	 * @param state Optional state to pass to the view
	 * @param matcher Optional function to find existing views that match (defaults to any view of the same type)
	 * @param openMode Optional mode: 'current' (reuse current), 'tab' (new tab), 'split' (split), 'right' (right sidebar)
	 * @returns The WorkspaceLeaf containing the view
	 */
	async openViewWithStandardBehavior(
		viewType: string,
		state?: any,
		matcher?: (leaf: WorkspaceLeaf) => boolean,
		openMode?: 'current' | 'tab' | 'split' | 'right'
	): Promise<WorkspaceLeaf | null> {
		try {
			// 1. First check if any existing view of this type is currently active
			// If so, just update its state instead of creating/finding another view
			const allLeavesOfType = this.app.workspace.getLeavesOfType(viewType);
			const activeViewLeaf = allLeavesOfType.find(leaf => {
				// Check if this leaf is currently active/focused
				// We can check this by seeing if the tab header has the 'is-active' class
				try {
					const tabHeaderEl = (leaf as any).tabHeaderEl;
					return tabHeaderEl && tabHeaderEl.classList.contains('is-active');
				} catch (e) {
					return false;
				}
			});

			if (activeViewLeaf) {
				// Active tab is same type - update its state
				await activeViewLeaf.setViewState({
					type: viewType,
					active: true,
					state: state || {}
				});
				return activeViewLeaf;
			}



			// 2. Determine how to open the new view
			let targetLeaf: WorkspaceLeaf | null = null;

			if (openMode === 'right') {
				// Force open in right sidebar
				targetLeaf = this.app.workspace.getRightLeaf(false);
			} else if (openMode === 'split') {
				// Force split
				targetLeaf = this.app.workspace.getLeaf('split');
			} else if (openMode === 'tab') {
				// Force new tab
				targetLeaf = this.app.workspace.getLeaf('tab');
			} else if (openMode === 'current') {
				// Force current leaf
				targetLeaf = this.app.workspace.getLeaf(false);
			} else {
				// Default behavior - create new tab
				// Since we already handled updating the active tab if it's the same type,
				// and we already handled existing views, just create a new tab
				targetLeaf = this.app.workspace.getLeaf('tab');
			}

			if (!targetLeaf) {
				console.error('Failed to get target leaf for view:', viewType);
				return null;
			}

			// 3. Set view state and reveal
			await targetLeaf.setViewState({
				type: viewType,
				active: true,
				state: state || {}
			});

			this.app.workspace.revealLeaf(targetLeaf);
			return targetLeaf;

		} catch (error) {
			console.error('Error opening view with standard behavior:', error);
			return null;
		}
	}

	async onload() {
		console.debug("Loading Life Navigator plugin");

		// Set the static instance reference
		if (!LifeNavigatorPlugin._instance) {
			LifeNavigatorPlugin._instance = this;
		} else {
			throw new Error('LifeNavigatorPlugin instance already exists');
		}

		// Make app available globally for navigation service
		(window as any).app = this.app;

		// Initialize i18n
		await initI18n(this.app);

		// Initialize Zustand store
		await initializeStore();

		// Auto-open Life Navigator if setup is incomplete (language not configured)
		this.app.workspace.onLayoutReady(() => {
			const store = getStore();
			const needsSetup = !store.getObsidianLanguageConfigured();

			if (needsSetup) {
				console.debug("Auto-opening Life Navigator for setup");
				// Small delay to ensure UI is stable
				setTimeout(() => {
					this.autoOpenForSetup();
				}, 1000);
			}

			// Subscribe to language configuration changes for dynamic auto-opening
			this.setupChangeSubscription = usePluginStore.subscribe(
				(state) => {
					try {
						return state.getObsidianLanguageConfigured();
					} catch {
						return true; // Assume configured if error reading
					}
				},
				(hasLanguageConfigured: boolean, prevHasLanguageConfigured: boolean) => {
					// If language configuration changed from true to false (tutorial reset)
					if (prevHasLanguageConfigured && !hasLanguageConfigured) {
						console.debug("Language configuration reset, auto-opening Life Navigator for setup");
						setTimeout(() => {
							this.autoOpenForSetup();
						}, 500);
					}
				},
				{ fireImmediately: false }
			);
		});

		// Initialize the obsidian tools with this plugin instance
		getObsidianTools();

		// Initialize user-defined tools manager
		this.userToolManager = new UserDefinedToolManager(this);
		await this.userToolManager.initialize();

		// Register the view types
		this.registerView(LIFE_NAVIGATOR_VIEW_TYPE, (leaf) => {
			return new LifeNavigatorView(leaf);
		});

		this.registerView(COST_ANALYSIS_VIEW_TYPE, (leaf) => {
			return new CostAnalysisView(leaf);
		});

		this.registerView(SYSTEM_PROMPT_VIEW_TYPE, (leaf) => {
			return new SystemPromptView(leaf);
		});

		// Add command to reset tutorial
		this.addCommand({
			id: "reset-tutorial",
			name: t("tools.resetTutorial"),
			callback: async () => {
				try {
					// Use the setup slice from the store
					const { getStore: getStoreState } = await import('./store/plugin-store');
					const store = getStoreState();
					await store.resetTutorialState();
					new Notice(t('settings.actions.resetTutorial.success'));

					// Optionally reload the plugin view to show setup screens
					setTimeout(() => {
						// Trigger a refresh of the Life Navigator view if it's open
						this.app.workspace.trigger('layout-change');
					}, 500);
				} catch (error) {
					console.error('Error resetting tutorial:', error);
					new Notice(t('settings.actions.resetTutorial.error', { error: error.message }));
				}
			},
		});

		// Add command to open cost analysis
		this.addCommand({
			id: "open-cost-analysis",
			name: t('costAnalysis.commands.openCostAnalysis'),
			callback: async () => {
				await this.openCostAnalysis();
			},
		});

		// Add command to open system prompt
		this.addCommand({
			id: 'open-system-prompt',
			name: t('systemPrompt.commands.openSystemPrompt'),
			callback: async () => {
				const activeModeId = usePluginStore.getState().modes.activeId;
				await this.openSystemPrompt(activeModeId);
			}
		});

		// Add a ribbon icon for the Life Navigator
		this.addRibbonIcon("compass", t("tools.openLifeNavigator"), async (evt: MouseEvent) => {
			console.debug("Starting Life Navigator session");

			try {
				const state = {
					initialMessages: [],
				};

				// Ribbon icons traditionally open in right sidebar
				await this.openViewWithStandardBehavior(LIFE_NAVIGATOR_VIEW_TYPE, state, undefined, 'right');

			} catch (error) {
				console.error("Error in runAICoach:", error);
				new Notice(
					`${t("errors.startingLifeNavigator")}: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		});

		// Add command to update the plugin from the latest GitHub release with version checks
		this.addCommand({
			id: "check-for-updates",
			name: t("tools.checkForUpdates"),
			callback: async () => {
				new Notice(t("messages.checkingForUpdates"));

				try {
					const updateInfo = await checkForAvailableUpdate(this.app);

					if (!updateInfo) {
						// silently fail
						return;
					}

					if (!updateInfo.hasUpdate) {
						new Notice(t("messages.pluginUpToDate", { version: updateInfo.currentVersion }));
						return;
					}

					// Notify user that a new version is found and download is starting
					new Notice(t("messages.newVersionFoundDownloading", {
						latestVersion: updateInfo.latestVersion,
						currentVersion: updateInfo.currentVersion
					}));

					const assets = updateInfo.releaseInfo.assets;

					// Helper to download and save an asset
					const saveAsset = async (assetName: string) => {
						const asset = assets.find((a: { name: string; }) => a.name === assetName);
						if (!asset) {
							console.debug(`Asset ${assetName} not found in release`);
							return;
						}

						console.debug(`Downloading asset ${assetName}`);

						try {
							// Direct download with requestUrl - this method is working successfully
							console.debug(`Using requestUrl with ${asset.browser_download_url}`);
							const response = await requestUrl({
								url: asset.browser_download_url,
								method: 'GET',
								headers: {
									'User-Agent': 'Obsidian-Day-Composer',
								},
								throw: false
							});

							if (response.status >= 200 && response.status < 300 && response.arrayBuffer) {
								const targetPath = this.app.vault.configDir + `/plugins/life-navigator/${assetName}`;
								console.debug(`Saving asset to ${targetPath}`);

								// @ts-ignore
								await this.app.vault.adapter.writeBinary(targetPath, response.arrayBuffer);
								console.debug(`Successfully saved ${assetName}`);
							} else {
								throw new Error(`Failed to download ${assetName}: HTTP ${response.status}`);
							}
						} catch (error) {
							console.error(`Error downloading ${assetName}:`, error);
							throw error;
						}
					};

					// Download and save each asset
					console.debug("Starting asset downloads...");
					await saveAsset("main.js");
					await saveAsset("manifest.json");
					await saveAsset("styles.css"); // If it exists
					console.debug("All assets downloaded successfully");

					// Show a modal to ask the user if they want to reload Obsidian.
					new ConfirmReloadModal(this.app, () => {
						// @ts-ignore
						this.app.commands.executeCommandById('app:reload');
					}, updateInfo.currentVersion, updateInfo.latestVersion).open();

				} catch (e) {
					new Notice(t("errors.failedToUpdatePlugin", { error: e instanceof Error ? e.message : String(e) }));
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new LifeNavigatorSettingTab(this.app, this));

		// Check for updates on startup
		await checkForUpdatesOnStartup(this);
	}

	async onunload() {
		console.debug("Unloading Life Navigator plugin");

		// Save any pending changes immediately before unloading
		await usePluginStore.getState().saveImmediatelyIfNeeded(false);

		// Cleanup setup change subscription
		if (this.setupChangeSubscription) {
			this.setupChangeSubscription();
			this.setupChangeSubscription = null;
		}

		// Cleanup user-defined tools manager
		if (this.userToolManager) {
			this.userToolManager.cleanup();
		}

		cleanupStore();

		// Clear the static instance reference
		if (LifeNavigatorPlugin._instance) {
			LifeNavigatorPlugin._instance = null;
		} else {
			throw new Error('LifeNavigatorPlugin instance not found');
		}

		resetObsidianTools();
	}

	private async autoOpenForSetup(): Promise<void> {
		try {
			const state = {
				initialMessages: [],
			};

			// For setup, always open in the right sidebar for less intrusive experience
			await this.openViewWithStandardBehavior(LIFE_NAVIGATOR_VIEW_TYPE, state, undefined, 'right');

		} catch (error) {
			console.error("Error auto-opening Life Navigator for setup:", error);
			// Fail silently to avoid disrupting user experience
		}
	}

	async openCostAnalysis(conversationId?: string): Promise<void> {
		try {
			// Determine target conversation ID
			let targetConversationId: string;

			if (conversationId) {
				targetConversationId = conversationId;
			} else {
				// Use current conversation ID if none provided
				const currentConversation = usePluginStore.getState().chats.current;
				if (!currentConversation.meta.id) {
					new Notice(t('costAnalysis.errors.noConversationAvailable'));
					return;
				}
				targetConversationId = currentConversation.meta.id;
			}

			// Use standardized behavior - match existing views by conversation ID
			const state = {
				conversationId: targetConversationId,
				conversationTitle: t('chat.titles.newChat')
			};

			const matcher = (leaf: WorkspaceLeaf) => {
				const view = leaf.view as CostAnalysisView;
				return view.getState()?.conversationId === targetConversationId;
			};

			// Open in main area using standard behavior
			await this.openViewWithStandardBehavior(COST_ANALYSIS_VIEW_TYPE, state, matcher);

		} catch (error) {
			console.error("Error opening cost analysis view:", error);
			new Notice(t('costAnalysis.errors.failedToOpen', { error: error instanceof Error ? error.message : String(error) }));
		}
	}

	async openSystemPrompt(modeId: string): Promise<void> {
		try {
			const state: SystemPromptViewState = {
				modeId: modeId
			};

			// Match existing system prompt views for the same mode
			const matcher = (leaf: WorkspaceLeaf) => {
				const view = leaf.view as SystemPromptView;
				// Check if this view is for the same mode
				return view && view.getState().modeId === modeId;
			};

			// Use standard behavior, but prefer split mode for system prompts as they're often reference material
			const resultLeaf = await this.openViewWithStandardBehavior(SYSTEM_PROMPT_VIEW_TYPE, state, matcher);

			// Set mode ID on the view if successful
			if (resultLeaf) {
				const view = resultLeaf.view as SystemPromptView;
				view.setState({ modeId: modeId }, null);
			}

		} catch (error) {
			console.error("Error opening system prompt view:", error);
			new Notice(t('systemPrompt.errors.failedToOpen', {
				error: error instanceof Error ? error.message : String(error)
			}));
		}
	}
}
