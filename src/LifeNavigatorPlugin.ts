import { Plugin, Notice, requestUrl } from 'obsidian';
import { ConfirmReloadModal } from './components/ConfirmReloadModal';
import { createStarterKit } from './create-starter-kit';
import { initI18n, t } from './i18n';
import { LifeNavigatorView, LIFE_NAVIGATOR_VIEW_TYPE } from './life-navigator-view';
import { checkForAvailableUpdate, checkForUpdatesOnStartup } from './auto-update';
import { createNewMode } from './utils/mode/create-new-mode';
import { getObsidianTools, resetObsidianTools } from './obsidian-tools';
import { LifeNavigatorSettingTab } from './settings/LifeNavigatorSettingTab';
import { createPluginSettings, loadPluginSettings, getPluginSettings } from './settings/LifeNavigatorSettings';
import { UserDefinedToolManager } from './user-tools/UserDefinedToolManager';

export class LifeNavigatorPlugin extends Plugin {
	view: LifeNavigatorView | null = null;
	userToolManager: UserDefinedToolManager | null = null;

	async onload() {
		console.log("Loading Life Navigator plugin");

		// Make app available globally for navigation service
		(window as any).app = this.app;

		// Initialize i18n
		await initI18n(this.app);

		// Initialize the plugin settings
		createPluginSettings(this);
		await loadPluginSettings(this);

		// Initialize the obsidian tools with this plugin instance
		getObsidianTools(this);

		// Initialize user-defined tools manager
		this.userToolManager = new UserDefinedToolManager(this);
		await this.userToolManager.initialize();

		// Register the view type
		this.registerView(LIFE_NAVIGATOR_VIEW_TYPE, (leaf) => {
			// Create view with empty context first
			this.view = new LifeNavigatorView(leaf, {
				initialMessages: [],
				plugin: this,
			});

			return this.view;

		});


		// Add command to create a Starter Kit
		this.addCommand({
			id: "create-starter-kit",
			name: t("tools.createStarterKit"),
			callback: async () => {
				new Notice(t("messages.creatingStarterKit"));
				await createStarterKit(this.app);
			},
		});

		// Add command to create a single mode
		this.addCommand({
			id: "create-new-mode",
			name: t("tools.createNewMode"),
			callback: async () => {
				await createNewMode(this.app);
			},
		});

		// Add command to reset tutorial
		this.addCommand({
			id: "reset-tutorial",
			name: t("tools.resetTutorial"),
			callback: async () => {
				try {
					const settings = getPluginSettings();
					await settings.resetTutorial();
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

		// Add a ribbon icon for the Life Navigator
		this.addRibbonIcon("compass", t("tools.openLifeNavigator"), async (evt: MouseEvent) => {
			console.log("Starting Life Navigator session");

			try {
				// Check if the view is already open in a leaf
				const leaves = this.app.workspace.getLeavesOfType(LIFE_NAVIGATOR_VIEW_TYPE);

				if (leaves.length > 0) {
					// View is already open, just focus on it
					const viewLeaf = leaves[0];
					this.app.workspace.revealLeaf(viewLeaf);
				} else {
					// Open the view in a new leaf
					const rightLeaf = this.app.workspace.getRightLeaf(false);
					if (rightLeaf) {
						// Get context before setting view state - using the AIAgent
						await rightLeaf.setViewState({
							type: LIFE_NAVIGATOR_VIEW_TYPE,
							active: true,
							state: {
								initialMessages: [],
							},
						});

						// Reveal the leaf
						this.app.workspace.revealLeaf(rightLeaf);
					}
				}
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
							console.log(`Asset ${assetName} not found in release`);
							return;
						}

						console.log(`Downloading asset ${assetName}`);

						try {
							// Direct download with requestUrl - this method is working successfully
							console.log(`Using requestUrl with ${asset.browser_download_url}`);
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
								console.log(`Saving asset to ${targetPath}`);

								// @ts-ignore
								await this.app.vault.adapter.writeBinary(targetPath, response.arrayBuffer);
								console.log(`Successfully saved ${assetName}`);
							} else {
								throw new Error(`Failed to download ${assetName}: HTTP ${response.status}`);
							}
						} catch (error) {
							console.error(`Error downloading ${assetName}:`, error);
							throw error;
						}
					};

					// Download and save each asset
					console.log("Starting asset downloads...");
					await saveAsset("main.js");
					await saveAsset("manifest.json");
					await saveAsset("styles.css"); // If it exists
					console.log("All assets downloaded successfully");

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

	onunload() {
		console.log("Unloading Life Navigator plugin");
		resetObsidianTools();
	}
}
