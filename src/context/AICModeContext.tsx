import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
	useCallback,
} from "react";
import { AICMode } from "../types/types";
import { App, TFile, TFolder, EventRef, Notice } from "obsidian";
import {
	mergeWithDefaultMode,
	DEFAULT_AIC_MODE,
	validateModeSettings,
} from "../defaults/aic-mode-defaults";
import { modeToNoteContent } from "../utils/mode-utils";
import * as yaml from "js-yaml";
import { ContextCollector } from "src/context-collector";
import { useTextToSpeech } from "../context/TextToSpeechContext";
import { t } from '../i18n';

// Define the built-in AIC modes that can be used to create initial modes
export const builtInAICModes: (Partial<AICMode> & { aic_name: string })[] = [
	{
		aic_name: t('modes.builtIn.createDailyNote.name'),
		aic_example_usages: [
			t('modes.builtIn.createDailyNote.exampleUsage'),
		],
		aic_voice_autoplay: true,
		aic_voice: "alloy",
		aic_voice_instructions: t('modes.builtIn.createDailyNote.voiceInstructions'),
		aic_voice_speed: 1.1,
		aic_icon: "calendar-with-checkmark",
		aic_icon_color: "#4caf50",
		aic_description: t('modes.builtIn.createDailyNote.description'),
		aic_system_prompt: DEFAULT_AIC_MODE.aic_system_prompt,
	},
	{
		aic_name: t('modes.builtIn.searchNotes.name'),
		aic_voice_autoplay: false,
		aic_voice: "echo",
		aic_voice_instructions: t('modes.builtIn.searchNotes.voiceInstructions'),
		aic_voice_speed: 0.9,
		aic_icon: "search",
		aic_icon_color: "#2196f3",
		aic_description: t('modes.builtIn.searchNotes.description'),
		aic_system_prompt: t('modes.builtIn.searchNotes.systemPrompt'),
	},
	{
		aic_name: t('modes.builtIn.dailyReflection.name'),
		aic_example_usages: [
			t('modes.builtIn.dailyReflection.exampleUsage'),
		],
		aic_voice_autoplay: true,
		aic_voice: "nova",
		aic_voice_instructions: t('modes.builtIn.dailyReflection.voiceInstructions'),
		aic_voice_speed: 0.85,
		aic_icon: "lucide-sun-moon",
		aic_icon_color: "#ff9800",
		aic_description: t('modes.builtIn.dailyReflection.description'),
		aic_system_prompt: DEFAULT_AIC_MODE.aic_system_prompt,
	},
	{
		aic_name: t('modes.builtIn.testSearch.name'),
		aic_example_usages: [
			t('modes.builtIn.testSearch.exampleUsage'),
		],
		aic_voice_autoplay: true,
		aic_voice: "shimmer",
		aic_voice_instructions: t('modes.builtIn.testSearch.voiceInstructions'),
		aic_voice_speed: 1.0,
		aic_icon: "magnifying-glass",
		aic_icon_color: "#ff5722",
		aic_description: t('modes.builtIn.testSearch.description'),
		aic_system_prompt: DEFAULT_AIC_MODE.aic_system_prompt,
	},
	{
		aic_name: t('modes.builtIn.addGoals.name'),
		aic_example_usages: [
			t('modes.builtIn.addGoals.exampleUsage'),
		],
		aic_voice_autoplay: true,
		aic_voice: "fable",
		aic_voice_instructions: t('modes.builtIn.addGoals.voiceInstructions'),
		aic_voice_speed: 1.15,
		aic_icon: "target",
		aic_icon_color: "#9c27b0",
		aic_description: t('modes.builtIn.addGoals.description'),
		aic_system_prompt: DEFAULT_AIC_MODE.aic_system_prompt,
	},
	{
		aic_name: t('modes.builtIn.addReflection.name'),
		aic_example_usages: [
			t('modes.builtIn.addReflection.exampleUsage'),
		],
		aic_voice_autoplay: true,
		aic_voice: "onyx",
		aic_voice_instructions: t('modes.builtIn.addReflection.voiceInstructions'),
		aic_voice_speed: 0.95,
		aic_icon: "lucide-history",
		aic_icon_color: "#673ab7",
		aic_description: t('modes.builtIn.addReflection.description'),
		aic_system_prompt: DEFAULT_AIC_MODE.aic_system_prompt,
	},
	{
		aic_name: t('modes.builtIn.createTomorrowNote.name'),
		aic_example_usages: [
			t('modes.builtIn.createTomorrowNote.exampleUsage'),
		],
		aic_voice_autoplay: true,
		aic_voice: "alloy",
		aic_voice_instructions: t('modes.builtIn.createTomorrowNote.voiceInstructions'),
		aic_voice_speed: 1.05,
		aic_icon: "lucide-calendar-plus",
		aic_icon_color: "#3f51b5",
		aic_description: t('modes.builtIn.createTomorrowNote.description'),
		aic_system_prompt: DEFAULT_AIC_MODE.aic_system_prompt,
	},
	{
		aic_name: t('modes.builtIn.searchProjectPlanning.name'),
		aic_example_usages: [
			t('modes.builtIn.searchProjectPlanning.exampleUsage'),
		],
		aic_voice_autoplay: true,
		aic_voice: "echo",
		aic_voice_instructions: t('modes.builtIn.searchProjectPlanning.voiceInstructions'),
		aic_voice_speed: 1.0,
		aic_icon: "lucide-file-search",
		aic_icon_color: "#00bcd4",
		aic_description: t('modes.builtIn.searchProjectPlanning.description'),
		aic_system_prompt: DEFAULT_AIC_MODE.aic_system_prompt,
	},
];

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

export interface AICModeContextType {
	aicModes: Record<string, AICMode>;
	activeModeId: string;
	setActiveMode: (mode: AICMode | null) => void;
	loadAICModes: () => Promise<void>;
	createInitialAICModes: () => Promise<void>;
	createSingleMode: () => Promise<void>;
	isCreatingAICModes: boolean;
	defaultAICMode: Partial<AICMode>;
}

const AICModeContext = createContext<AICModeContextType | undefined>(undefined);

export const AICModeProvider: React.FC<{
	children: ReactNode;
	app: App;
}> = ({ children, app }) => {
	const [aicModes, setAICModes] = useState<Record<string, AICMode>>({
		default: DEFAULT_AIC_MODE,
	});
	const [activeModeId, setActiveModeId] = useState<string>("default");
	const [fileEventRefs, setFileEventRefs] = useState<EventRef[]>([]);
	const [modeFilePaths, setModeFilePaths] = useState<Set<string>>(new Set());
	const [isCreatingAICModes, setIsCreatingAICModes] = useState(false);
	const textToSpeech = useTextToSpeech();

	// Function to extract an AIC mode from a file with the #aic-mode tag
	const extractAICModeFromFile = async (
		file: TFile,
	): Promise<AICMode | null> => {
		try {
			const content = await app.vault.read(file);

			// Check if content is valid
			if (content.trim().length === 0) {
				console.warn(t('ui.mode.files.skippingEmpty').replace('{{filename}}', file.path));
				return null;
			}

			// Check if file has #aic-mode tag
			const cache = app.metadataCache.getFileCache(file);
			const tags = cache?.tags?.map((tag) => tag.tag) || [];
			const frontmatterTags = cache?.frontmatter?.tags || [];

			// Convert frontmatter tags to array if it's a string
			const normalizedFrontmatterTags = Array.isArray(frontmatterTags)
				? frontmatterTags
				: [frontmatterTags];

			// Check if the file has the #aic-mode tag
			const hasAicModeTag =
				tags.includes("#aic-mode") ||
				normalizedFrontmatterTags.includes("aic-mode");

			if (!hasAicModeTag) {
				return null;
			}

			// Parse frontmatter and content
			const frontmatterMatch = content.match(
				/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,
			);

			if (!frontmatterMatch) {
				console.warn(
					t('ui.mode.files.noFrontmatter').replace('{{filename}}', file.name)
				);
				// Create partial mode with only required fields
				const partialMode: Partial<AICMode> = {
					aic_name: file.basename,
					aic_path: file.path,
					aic_system_prompt: content.trim(),
				};

				// Merge with defaults
				return mergeWithDefaultMode(partialMode);
			}

			const [, frontmatterStr, contentStr] = frontmatterMatch;

			// Parse frontmatter using js-yaml
			let frontmatter: Record<string, any>;
			try {
				frontmatter =
					(yaml.load(frontmatterStr) as Record<string, any>) || {};
			} catch (yamlError) {
				console.error(`Error parsing YAML in ${file.path}:`, yamlError);
				frontmatter = {};
			}
			// Create a partial AICMode object
			const partialMode: Partial<AICMode> = {
				// Required fields
				aic_name: frontmatter.aic_name || file.basename,
				aic_path: file.path,

				// UI elements
				aic_icon: frontmatter.aic_icon,
				aic_icon_color: frontmatter.aic_icon_color,
				aic_description: frontmatter.aic_description,

				// Behavior
				aic_example_usages: Array.isArray(
					frontmatter.aic_example_usages,
				)
					? frontmatter.aic_example_usages
					: frontmatter.aic_example_usages
						? [frontmatter.aic_example_usages]
						: [],



				// API parameters
				aic_thinking_budget_tokens:
					frontmatter.aic_thinking_budget_tokens !== undefined
						? parseInt(
								String(frontmatter.aic_thinking_budget_tokens),
							)
						: undefined,
				aic_max_tokens:
					frontmatter.aic_max_tokens !== undefined
						? parseInt(String(frontmatter.aic_max_tokens))
						: undefined,

				// TTS settings
				aic_voice_autoplay:
					frontmatter.aic_voice_autoplay !== undefined
						? String(
								frontmatter.aic_voice_autoplay,
							).toLowerCase() === "true"
						: undefined,
				aic_voice: frontmatter.aic_voice,
				aic_voice_instructions: frontmatter.aic_voice_instructions,
				aic_voice_speed:
					frontmatter.aic_voice_speed !== undefined
						? parseFloat(String(frontmatter.aic_voice_speed))
						: undefined,
			};

			//expand links in contentStr
			partialMode.aic_system_prompt = await new ContextCollector(
				app,
			).expandLinks(contentStr);


			// Merge with defaults and return
			return mergeWithDefaultMode(partialMode);
		} catch (error) {
			console.error(`Error reading file ${file.path}:`, error);
			return null;
		}
	};

	const loadAICModes = useCallback(async () => {
		try {
			// Get all markdown files in the vault
			const files = app.vault.getMarkdownFiles();
			const modesMap: Record<string, AICMode> = {};

			for (const file of files) {
				const mode = await extractAICModeFromFile(file);
				if (mode && mode.aic_path) {
					modesMap[mode.aic_path] = mode;
				}
			}

			// Add default mode to the map
			if (Object.keys(modesMap).length === 0) {
				modesMap["default"] = DEFAULT_AIC_MODE;
			}

			setAICModes(modesMap);
			console.log(
				t('ui.mode.files.loadedCount').replace('{{count}}', (Object.keys(modesMap).length - 1).toString())
			);

			// If active mode no longer exists, set it to the first available mode
			if (activeModeId && !modesMap[activeModeId]) {
				const firstModeId = Object.keys(modesMap)[0] || "default";
				setActiveModeId(firstModeId);
			}
		} catch (error) {
			console.error("Error loading AIC modes:", error);
		}
	}, [app, activeModeId]);

	// Update mode file paths when modes change
	useEffect(() => {
		setModeFilePaths(
			new Set(Object.keys(aicModes).filter((path) => path !== "default")),
		);
	}, [aicModes]);

	// Setup vault event listeners
	useEffect(() => {
		// Clean up existing event references
		return () => {
			fileEventRefs.forEach((ref) => app.vault.offref(ref));
		};
	}, [app, fileEventRefs]);

	// Helper to check if file has or had the #aic-mode tag
	const hasAICModeTag = (file: TFile): boolean => {
		const cache = app.metadataCache.getFileCache(file);
		const tags = cache?.tags?.map((tag) => tag.tag) || [];
		const frontmatterTags = cache?.frontmatter?.tags || [];

		// Convert frontmatter tags to array if it's a string
		const normalizedFrontmatterTags = Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];

		return (
			tags.includes("#aic-mode") ||
			normalizedFrontmatterTags.includes("aic-mode")
		);
	};

	// Register file event handlers
	useEffect(() => {
		const refs: EventRef[] = [];

		// When a file is created
		const createRef = app.vault.on("create", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				console.log("File created:", file.path);
				// Wait for metadata to be indexed
				setTimeout(() => {
					if (hasAICModeTag(file)) {
						loadAICModes();
					}
				}, 100);
			}
		});
		refs.push(createRef);

		// When a file is modified
		const modifyRef = app.vault.on("modify", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				// Check if this file had or has the tag
				const hadTag = modeFilePaths.has(file.path);

				// Wait for metadata to be indexed
				setTimeout(() => {
					const hasTag = hasAICModeTag(file);
					if (hadTag || hasTag) {
						loadAICModes();
					}
				}, 100);
			}
		});
		refs.push(modifyRef);

		// When a file is deleted
		const deleteRef = app.vault.on("delete", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				// If this was a mode file, reload modes
				if (modeFilePaths.has(file.path)) {
					loadAICModes();
				}
			}
		});
		refs.push(deleteRef);

		// When a file is renamed
		const renameRef = app.vault.on("rename", (file, oldPath) => {
			if (file instanceof TFile && file.extension === "md") {
				// If this was a mode file, reload modes
				if (modeFilePaths.has(oldPath)) {
					loadAICModes();
				} else {
					// Wait for metadata to be indexed
					setTimeout(() => {
						if (hasAICModeTag(file)) {
							loadAICModes();
						}
					}, 100);
				}
			}
		});
		refs.push(renameRef);

		// When metadata is changed
		const metadataRef = app.metadataCache.on("changed", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				// Check if this file had the tag before
				const hadTag = modeFilePaths.has(file.path);
				const hasTag = hasAICModeTag(file);

				// Only reload if tag status changed
				if (hadTag !== hasTag) {
					loadAICModes();
				}
			}
		});
		refs.push(metadataRef);

		setFileEventRefs(refs);

		return () => {
			refs.forEach((ref) => app.vault.offref(ref));
		};
	}, [app, loadAICModes, modeFilePaths]);

	// Load modes when component mounts
	useEffect(() => {
		loadAICModes();
	}, [loadAICModes]);

	// Create a new function to create initial AIC modes
	const createInitialAICModes = useCallback(async () => {
		try {
			setIsCreatingAICModes(true);

			// Create an AIC Modes folder if it doesn't exist
			let modesFolder: TFolder;
			if (!app.vault.getAbstractFileByPath("Starter Pack")) {
				modesFolder = await app.vault.createFolder("Starter Pack");
			} else {
				modesFolder = app.vault.getAbstractFileByPath(
					"Starter Pack",
				) as TFolder;
			}

			// Create a mode file for each built-in mode
			const newModesMap: Record<string, AICMode> = { ...aicModes };

			for (const mode of builtInAICModes) {
				const fileName = `${mode.aic_name.replace(/[^a-zA-Z0-9 ]/g, "")}.md`;
				const filePath = `${modesFolder.path}/${fileName}`;

				// Check if file already exists
				if (app.vault.getAbstractFileByPath(filePath)) {
					continue; // Skip if file already exists
				}

				// Create a complete mode object by merging with defaults
				const completeMode: AICMode = {
					...mergeWithDefaultMode(mode),
					aic_path: filePath,
				};

				// Convert mode to note content using the utility function
				const fileContent = modeToNoteContent(completeMode);

				await app.vault.create(filePath, fileContent);

				// Add to our map
				newModesMap[filePath] = completeMode;
			}

			// Update modes
			setAICModes(newModesMap);

			setIsCreatingAICModes(false);
			new Notice(t('ui.starterPack.createdSuccess'));
		} catch (error) {
			new Notice(t('ui.starterPack.createdError').replace('{{error}}', String(error)));
			console.error("Error creating a Starter Pack:", error);
			setIsCreatingAICModes(false);
		}
	}, [app, aicModes]);

	// Create a new function to create a single mode
	const createSingleMode = useCallback(async () => {
		try {
			setIsCreatingAICModes(true);

			// Randomly select an icon and color
			const randomIcon = AVAILABLE_ICONS[Math.floor(Math.random() * AVAILABLE_ICONS.length)];
			const randomColor = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];

			// Create a new mode with default values
			const newMode: Partial<AICMode> = {
				aic_name: t('ui.mode.newMode'),
				aic_description: t('ui.mode.defaultDescription'),
				aic_icon: randomIcon,
				aic_icon_color: randomColor,
				aic_system_prompt: DEFAULT_AIC_MODE.aic_system_prompt,
				aic_example_usages: [],
				aic_voice_autoplay: true,
				aic_voice: "alloy",
				aic_voice_instructions: t('ui.mode.defaultVoiceInstructions'),
				aic_voice_speed: 1.0,
			};

			// Ensure aic_name is defined
			const baseModeName = newMode.aic_name || t('ui.mode.newMode');
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
				aic_path: filePath,
				aic_name: fileName.replace(".md", ""), // Update the name to match the file name
			};

			// Convert mode to note content using the utility function
			const fileContent = modeToNoteContent(completeMode);

			// Create the file
			const newFile = await app.vault.create(filePath, fileContent);

			// Update modes
			setAICModes((prev) => ({
				...prev,
				[filePath]: completeMode,
			}));

			setIsCreatingAICModes(false);
			
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
			setIsCreatingAICModes(false);
		}
	}, [app]);

	// Helper to set the active mode
	const setActiveMode = useCallback(
		(mode: AICMode | null) => {
			if (!mode) {
				setActiveModeId("default");

				// Update text-to-speech settings for the default mode
				textToSpeech.setTTSSettings({
					enabled: DEFAULT_AIC_MODE.aic_voice_autoplay,
					voice: DEFAULT_AIC_MODE.aic_voice,
					instructions: DEFAULT_AIC_MODE.aic_voice_instructions,
					speed: DEFAULT_AIC_MODE.aic_voice_speed,
				});

				return;
			}

			// Merge with defaults and validate settings
			const completeMode = validateModeSettings(
				mergeWithDefaultMode(mode),
			);

			// Save in modes if not already there (shouldn't usually happen)
			if (completeMode.aic_path && !aicModes[completeMode.aic_path]) {
				setAICModes((prev) => ({
					...prev,
					[completeMode.aic_path]: completeMode,
				}));
			}

			// Set active mode ID
			setActiveModeId(completeMode.aic_path);

			// Update text-to-speech settings for the new mode
			textToSpeech.setTTSSettings({
				enabled: completeMode.aic_voice_autoplay,
				voice: completeMode.aic_voice,
				instructions: completeMode.aic_voice_instructions,
				speed: completeMode.aic_voice_speed,
			});
		},
		[aicModes, textToSpeech],
	);

	// Context value that provides the modes and functionality
	const contextValue: AICModeContextType = {
		aicModes,
		activeModeId,
		setActiveMode,
		loadAICModes,
		createInitialAICModes,
		createSingleMode,
		isCreatingAICModes,
		defaultAICMode: DEFAULT_AIC_MODE,
	};

	return (
		<AICModeContext.Provider value={contextValue}>
			{children}
		</AICModeContext.Provider>
	);
};

// Custom hook for using the AIC Mode context
export const useAICMode = () => {
	const context = useContext(AICModeContext);
	if (context === undefined) {
		throw new Error("useAICMode must be used within an AICModeProvider");
	}
	return context;
};
