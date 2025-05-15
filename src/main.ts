import { Notice, Plugin } from "obsidian";
import { SampleSettingTab } from "./settings/SettingsTab";
import { ContextCollector } from "./context-collector";
import {
	getPluginSettings,
	resetPluginSettings,
} from "./settings/PluginSettings";
import { resetObsidianTools } from "./obsidian-tools";
import * as ReactDOM from "react-dom/client";
import { AI_COACH_VIEW_TYPE, AICoachView } from "./ai-coach-view";
import { getObsidianTools } from "./obsidian-tools";
import * as React from "react";
import { initI18n, t } from "./i18n";

export default class MyPlugin extends Plugin {
	contextCollector: ContextCollector;
	view: AICoachView | null = null;

	async onload() {
		console.log("Loading AI Coach plugin");

		// Initialize i18n
		await initI18n(this.app);

		// Initialize the plugin settings
		const pluginSettings = getPluginSettings();
		pluginSettings.init(this);

		// Initialize the obsidian tools with this plugin instance
		getObsidianTools(this);

		// Initialize context collector
		this.contextCollector = new ContextCollector(this.app);

		// Register the view type
		this.registerView(AI_COACH_VIEW_TYPE, (leaf) => {
			// Create view with empty context first
			this.view = new AICoachView(leaf, {
				initialMessages: [],
				plugin: this,
			});

			return this.view;
		});

		// Helper function to create a React component with providers
		const createReactComponent = async (
			action: (context: any) => Promise<void>,
			errorMessage: string
		): Promise<void> => {
			try {
				// Import required modules
				const aicModeContextModule = await import("./context/AICModeContext");
				const textToSpeechModule = await import("./context/TextToSpeechContext");

				// Create a temporary container
				const container = document.createElement("div");
				const root = ReactDOM.createRoot(container);

				// Create a promise that will be resolved when the action is complete
				const actionPromise = new Promise<void>((resolve, reject) => {
					try {
						// Render the component with providers
						root.render(
							React.createElement(
								textToSpeechModule.TextToSpeechProvider,
								{
									children: React.createElement(
										aicModeContextModule.AICModeProvider,
										{
											app: this.app,
											children: React.createElement(() => {
												const context = aicModeContextModule.useAICMode();

												React.useEffect(() => {
													action(context)
														.then(() => {
															resolve();
															// Unmount after completion
															setTimeout(() => root.unmount(), 100);
														})
														.catch(reject);
												}, []);

												return React.createElement("div");
											}),
										},
									),
								},
							),
						);
					} catch (error) {
						reject(error);
					}
				});

				// Wait for the action to complete
				await actionPromise;
			} catch (error) {
				console.error(errorMessage, error);
				new Notice(
					`${t(errorMessage)}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		};

		// Add command to create a Starter Pack
		this.addCommand({
			id: "create-starter-pack",
			name: t("tools.createStarterPack"),
			callback: async () => {
				new Notice(t("messages.creatingStarterPack"));
				await createReactComponent(
					(context) => context.createInitialAICModes(),
					"errors.creatingStarterPack"
				);
			},
		});

		// Add command to create a single mode
		this.addCommand({
			id: "create-single-mode",
			name: t("tools.createSingleMode"),
			callback: async () => {
				await createReactComponent(
					(context) => context.createSingleMode(),
					"errors.creatingNewMode"
				);
			},
		});

		// Add a ribbon icon for the AI Coach
		this.addRibbonIcon("bot", t("tools.aiCoach"), async (evt: MouseEvent) => {
			console.log("Starting AI Coach session");

			try {
				// Check if the view is already open in a leaf
				const leaves =
					this.app.workspace.getLeavesOfType(AI_COACH_VIEW_TYPE);

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
							type: AI_COACH_VIEW_TYPE,
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
					`${t("errors.startingAICoach")}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		});

		// Compare versions helper
		function compareVersions(a: string, b: string): number {
			const pa = a.split('.').map(Number);
			const pb = b.split('.').map(Number);
			for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
				const na = pa[i] || 0, nb = pb[i] || 0;
				if (na > nb) return 1;
				if (na < nb) return -1;
			}
			return 0;
		}

		// Add command to update the plugin from the latest GitHub release with version checks
		this.addCommand({
			id: "update-plugin-from-github",
			name: "Update Plugin from Latest GitHub Release",
			callback: async () => {
				const repo = "cielecki/day-composer";
				const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
				new Notice("Checking for updates...");

				try {
					// Read current version from manifest.json
					const manifestPath = this.app.vault.configDir + "/plugins/day-composer/manifest.json";
					// @ts-ignore
					const manifestContent = await this.app.vault.adapter.read(manifestPath);
					const manifest = JSON.parse(manifestContent);
					const currentVersion = manifest.version;

					// Get latest release info
					const release = await fetch(apiUrl).then(res => res.json());
					const assets = release.assets;
					const latestVersion = release.tag_name.startsWith('v') ? release.tag_name.slice(1) : release.tag_name;

					const cmp = compareVersions(latestVersion, currentVersion);
					if (cmp <= 0) {
						new Notice(`Plugin is already up to date (version ${currentVersion}).`);
						return;
					}

					// Helper to download and save an asset
					const saveAsset = async (assetName: string) => {
						const asset = assets.find((a: any) => a.name === assetName);
						if (!asset) return;
						const data = await fetch(asset.browser_download_url).then(res => res.arrayBuffer());
						// @ts-ignore
						await this.app.vault.adapter.writeBinary(
							this.app.vault.configDir + `/plugins/day-composer/${assetName}`,
							data
						);
					};

					// Download and save each asset
					await saveAsset("main.js");
					await saveAsset("manifest.json");
					await saveAsset("styles.css"); // If it exists

					new Notice(`Plugin updated from version ${currentVersion} to ${latestVersion}! Please reload Obsidian to apply the update.`);
				} catch (e) {
					new Notice("Failed to update plugin: " + e);
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
		console.log("Unloading AI Coach plugin");
		resetObsidianTools();
		resetPluginSettings();
	}
}
