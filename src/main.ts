import { App, Notice, Plugin, requestUrl, TFolder } from "obsidian";
import { SampleSettingTab } from "./settings/SettingsTab";
import { ContextCollector } from "./context-collector";
import {
	getPluginSettings,
	resetPluginSettings,
} from "./settings/PluginSettings";
import { resetObsidianTools } from "./obsidian-tools";
import { AI_COACH_VIEW_TYPE, AICoachView } from "./ai-coach-view";
import { getObsidianTools } from "./obsidian-tools";
import { initI18n, t } from "./i18n";
import { getStarterPackContents } from "./defaults/ln-mode-defaults";
import { mergeWithDefaultMode } from "./defaults/ln-mode-defaults";
import { getDefaultAICMode } from "./defaults/ln-mode-defaults";
import { AICMode } from "./types/types";
import { modeToNoteContent } from "./utils/mode-utils";
import path from "path";



const createStarterPack = async (app: App) => {
	try {
		// Create an AIC Modes folder if it doesn't exist
		const starterPackDirName = t('ui.starterPack.directoryName') + " v0.1";
		for (const { name, content } of getStarterPackContents()) {
			const filePath = path.join(starterPackDirName, name);

			const directory = path.dirname(filePath);
			if (!app.vault.getAbstractFileByPath(directory)) {
				await app.vault.createFolder(directory);
			}

			// Check if file already exists
			if (app.vault.getAbstractFileByPath(filePath)) {
				continue; // Skip if file already exists
			}

			await app.vault.create(filePath, content);
		}

		new Notice(t('ui.starterPack.createdSuccess'));
	} catch (error) {
		new Notice(t('ui.starterPack.createdError').replace('{{error}}', String(error)));
		console.error("Error creating a Starter Pack:", error);
	}
};

// List of available Lucide icons used in the plugin
const AVAILABLE_ICONS = [
	"sparkles",
	"calendar-with-checkmark",
	"search",
	"lucide-sun-moon",
	"magnifying-glass",
	"target",
	"lucide-history",
	"lucide-calendar-plus",
	"lucide-file-search",
	"brain",
	"lock",
	"settings",
	"terminal",
	"plus",
	"list-checks",
	"square",
	"check-square",
	"x-square",
	"arrow-right-square",
	"info"
];

// List of available colors used in the plugin
const AVAILABLE_COLORS = [
	"#4caf50", // green
	"#2196f3", // blue
	"#ff9800", // orange
	"#ff5722", // deep orange
	"#9c27b0", // purple
	"#673ab7", // deep purple
	"#3f51b5", // indigo
	"#00bcd4", // cyan
	"#e91e63", // pink
	"#f44336", // red
	"#8bc34a", // light green
	"#cddc39", // lime
	"#ffc107", // amber
	"#795548", // brown
	"#607d8b"  // blue grey
];

// Create a new function to create a single mode
const createSingleMode = async (app: App) => {
	try {
		// Randomly select an icon and color
		const randomIcon = AVAILABLE_ICONS[Math.floor(Math.random() * AVAILABLE_ICONS.length)];
		const randomColor = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];

		// Create a new mode with default values
		const defaultMode = getDefaultAICMode();
		const newMode: Partial<AICMode> = {
			ln_name: t('ui.mode.newMode'),
			ln_description: t('ui.mode.defaultDescription'),
			ln_icon: randomIcon,
			ln_icon_color: randomColor,
			ln_system_prompt: defaultMode.ln_system_prompt,
			ln_example_usages: [],
			ln_voice_autoplay: true,
			ln_voice: "alloy",
			ln_voice_instructions: t('ui.mode.defaultVoiceInstructions'),
			ln_voice_speed: 1.0,
		};

		// Ensure ln_name is defined
		const baseModeName = newMode.ln_name || t('ui.mode.newMode');
		const sanitizedBaseName = baseModeName.replace(/[^a-zA-Z0-9 ]/g, "");

		// Find a unique filename by incrementing a number if needed
		let counter = 1;
		let fileName = `${sanitizedBaseName}.md`;
		let filePath = fileName;

		while (app.vault.getAbstractFileByPath(filePath)) {
			fileName = `${sanitizedBaseName} ${counter}.md`;
			filePath = fileName;
			counter++;
		}

		// Create a complete mode object by merging with defaults
		const completeMode: AICMode = {
			...mergeWithDefaultMode(newMode),
			ln_path: filePath,
			ln_name: fileName.replace(".md", ""), // Update the name to match the file name
		};

		// Convert mode to note content using the utility function
		const fileContent = modeToNoteContent(completeMode);

		// Create the file
		const newFile = await app.vault.create(filePath, fileContent);
		
		// Show a single notification
		new Notice(t('ui.mode.createdSuccess'));
		
		// Open the file in a new leaf
		if (newFile) {
			const leaf = app.workspace.getLeaf();
			await leaf.openFile(newFile);
		}
	} catch (error) {
		// Only show error notification if there's a problem
		new Notice(t('ui.mode.createdError').replace('{{error}}', String(error)));
		console.error("Error creating a new mode:", error);
	}
}

export default class MyPlugin extends Plugin {
	contextCollector: ContextCollector;
	view: AICoachView | null = null;

	async onload() {
		console.log("Loading Life Navigator plugin");

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


		// Add command to create a Starter Pack
		this.addCommand({
			id: "create-starter-pack",
			name: t("tools.createStarterPack"),
			callback: async () => {
				new Notice(t("messages.creatingStarterPack"));
				await createStarterPack(this.app);
			},
		});

		// Add command to create a single mode
		this.addCommand({
			id: "create-single-mode",
			name: t("tools.createSingleMode"),
			callback: async () => {
				await createSingleMode(this.app);
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
				const repo = "cielecki/life-navigator";
				const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
				new Notice("Checking for updates...");

				try {
					// Read current version from manifest.json
					const manifestPath = this.app.vault.configDir + "/plugins/life-navigator/manifest.json";
					// @ts-ignore
					const manifestContent = await this.app.vault.adapter.read(manifestPath);
					const manifest = JSON.parse(manifestContent);
					const currentVersion = manifest.version;

					// Get latest release info
					const release = await fetch(apiUrl, {
						headers: {
							'Accept': 'application/vnd.github+json',
							'User-Agent': 'Obsidian-Day-Composer'
						}
					}).then(res => res.json());
					
					console.log("Latest release info:", release);
					const assets = release.assets;
					const latestVersion = release.tag_name.startsWith('v') ? release.tag_name.slice(1) : release.tag_name;

					const cmp = compareVersions(latestVersion, currentVersion);
					if (cmp <= 0) {
						new Notice(`Plugin is already up to date (version ${currentVersion}).`);
						return;
					}

					// Helper to download and save an asset
					const saveAsset = async (assetName: string) => {
						const asset = assets.find((a: { name: string }) => a.name === assetName);
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
