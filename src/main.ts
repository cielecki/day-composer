import { App, Notice, Plugin, requestUrl, WorkspaceLeaf } from "obsidian";
import { SampleSettingTab } from "./settings/SettingsTab";
import { ContextCollector } from "./context-collector";
import {
	getPluginSettings,
	resetPluginSettings,
} from "./settings/PluginSettings";
import { resetObsidianTools } from "./obsidian-tools";
import { LIFE_NAVIGATOR_VIEW_TYPE, LifeNavigatorView } from "./life-navigator-view";
import { getObsidianTools } from "./obsidian-tools";
import { initI18n, t } from "./i18n";
import { LNMode } from "./types/types";
import { modeToNoteContent } from "./utils/mode-utils";
import path from "path";
import { getDefaultLNMode, mergeWithDefaultMode, DEFAULT_VOICE_INSTRUCTIONS } from "./defaults/ln-mode-defaults";
import { STARTER_KIT_DATA } from "./generated/starter-kit-data";
import { ConfirmReloadModal } from "./components/ConfirmReloadModal";

/**
 * Generates a unique directory name by appending a number suffix if the directory already exists
 * @param app Obsidian app instance
 * @param baseName Base directory name
 * @returns Promise<string> Unique directory name
 */
const generateUniqueDirectoryName = async (app: App, baseName: string): Promise<string> => {
	let directoryName = baseName;
	let counter = 2;

	// Check if the base directory exists
	while (app.vault.getAbstractFileByPath(directoryName)) {
		directoryName = `${baseName} ${counter}`;
		counter++;
	}

	return directoryName;
};

/**
 * Recursively creates nested directories, ensuring parent directories exist first
 * @param app Obsidian app instance
 * @param dirPath Directory path to create
 */
const createNestedDirectory = async (app: App, dirPath: string): Promise<void> => {
	if (!dirPath || dirPath === '.' || dirPath === '/') return;

	// Normalize the path to use forward slashes consistently
	const normalizedPath = dirPath.replace(/\\/g, '/');
	
	// Check if directory already exists
	if (app.vault.getAbstractFileByPath(normalizedPath)) {
		return;
	}

	// Get parent directory
	const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
	
	// Recursively create parent directory if it doesn't exist and has a valid path
	if (parentDir && parentDir !== normalizedPath) {
		await createNestedDirectory(app, parentDir);
	}

	// Create this directory only if it doesn't exist
	if (!app.vault.getAbstractFileByPath(normalizedPath)) {
		try {
			await app.vault.createFolder(normalizedPath);
		} catch (error) {
			// If folder already exists, that's fine - continue
			if (error.message && error.message.includes('already exists')) {
				return;
			}
			throw error;
		}
	}
};

const createStarterKit = async (app: App) => {
	try {
		const currentLanguage = window.localStorage.getItem('language') || 'en';
		const fallbackLanguage = 'en';

		const starterKitDirNameKey = 'ui.starterKit.directoryName';
		let baseStarterKitDirName = t(starterKitDirNameKey);

		baseStarterKitDirName = baseStarterKitDirName + " v0.8";

		// Generate a unique directory name
		const starterKitDirName = await generateUniqueDirectoryName(app, baseStarterKitDirName);

		// Check if we have files for the current language
		if (!STARTER_KIT_DATA[currentLanguage]) {
			console.warn(`No starter kit files defined for language: ${currentLanguage}. Falling back to ${fallbackLanguage}.`);
			
			// If fallback language also doesn't exist, show error and exit
			if (!STARTER_KIT_DATA[fallbackLanguage]) {
				new Notice(`Error: No starter kit files defined for current language (${currentLanguage}) or fallback (${fallbackLanguage}).`);
				console.error(`Starter Kit: No files for language ${currentLanguage} or fallback ${fallbackLanguage}.`);
				return;
			}
		}

		// Use current language files if available, otherwise fallback
		const starterFiles = STARTER_KIT_DATA[currentLanguage] || STARTER_KIT_DATA[fallbackLanguage];

		for (const item of starterFiles) { 
			// Get file details directly
			const { subPath, filename, content } = item;

			if (!filename) {
				new Notice(`Skipping file: missing filename.`);
				console.error(`Starter Kit: Critical - Missing filename for a file. Skipping.`);
				continue;
			}

			if (!content) {
				new Notice(`Skipping file '${filename}': missing content.`);
				console.error(`Starter Kit: Critical - Missing content for file ${filename}. Skipping.`);
				continue;
			}

			const filePath = path.join(starterKitDirName, subPath, filename);
			const directory = path.dirname(filePath);

			// Use the improved nested directory creation function
			await createNestedDirectory(app, directory);

			// Check if file already exists
			if (app.vault.getAbstractFileByPath(filePath)) {
				new Notice(`File ${filePath} already exists, skipping.`);
				continue; // Skip if file already exists
			}

			await app.vault.create(filePath, content);
		}

		new Notice(t('ui.starterKit.createdSuccess'));
	} catch (error) {
		new Notice(t('ui.starterKit.createdError', { error: String(error) }));
		console.error("Error creating a Starter Kit:", error);
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
const createNewMode = async (app: App) => {
	try {
		// Randomly select an icon and color
		const randomIcon = AVAILABLE_ICONS[Math.floor(Math.random() * AVAILABLE_ICONS.length)];
		const randomColor = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];

		// Create a new mode with default values
		const defaultMode = getDefaultLNMode();
		const newMode: Partial<LNMode> = {
			ln_name: t('ui.mode.newMode'),
			ln_description: t('ui.mode.defaultDescription'),
			ln_icon: randomIcon,
			ln_icon_color: randomColor,
			ln_system_prompt: defaultMode.ln_system_prompt,
			ln_example_usages: [],
			ln_voice_autoplay: true,
			ln_voice: "alloy",
			ln_voice_instructions: DEFAULT_VOICE_INSTRUCTIONS,
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
		const completeMode: LNMode = {
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
		new Notice(t('ui.mode.createdError', { error: String(error) }));
		console.error("Error creating a new mode:", error);
	}
}

export default class MyPlugin extends Plugin {
	contextCollector: ContextCollector;
	view: LifeNavigatorView | null = null;

	async onload() {
		console.log("Loading Life Navigator plugin");

		// Make app available globally for navigation service
		(window as any).app = this.app;

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
				const leaves =
					this.app.workspace.getLeavesOfType(LIFE_NAVIGATOR_VIEW_TYPE);

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
					`${t("errors.startingLifeNavigator")}: ${error instanceof Error ? error.message : String(error)}`,
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
			id: "check-for-updates",
			name: t("tools.checkForUpdates"),
			callback: async () => {
				const repo = "cielecki/life-navigator";
				const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
				new Notice(t("messages.checkingForUpdates"));

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
						new Notice(t("messages.pluginUpToDate", { version: currentVersion }));
						return;
					}

					// Notify user that a new version is found and download is starting
					new Notice(t("messages.newVersionFoundDownloading", { latestVersion, currentVersion }));

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

					// Show a modal to ask the user if they want to reload Obsidian.
					new ConfirmReloadModal(this.app, () => {
						// @ts-ignore
						this.app.commands.executeCommandById('app:reload');
					}, currentVersion, latestVersion).open();

				} catch (e) {
					new Notice(t("errors.failedToUpdatePlugin", { error: e instanceof Error ? e.message : String(e) }));
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
		console.log("Unloading Life Navigator plugin");
		resetObsidianTools();
		resetPluginSettings();
	}
}




