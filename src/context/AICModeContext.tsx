import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
	useCallback,
} from "react";
import { AICMode } from "../types/types";
import { App, TFile, EventRef } from "obsidian";
import {
	mergeWithDefaultMode,
	validateModeSettings,
	getDefaultAICMode,
} from "../defaults/aic-mode-defaults";
import * as yaml from "js-yaml";
import { ContextCollector } from "src/context-collector";
import { useTextToSpeech } from "../context/TextToSpeechContext";
import { t } from '../i18n';



export interface AICModeContextType {
	aicModes: Record<string, AICMode>;
	activeModeId: string;
	setActiveMode: (mode: AICMode | null) => void;
	loadAICModes: () => Promise<void>;
	defaultAICMode: Partial<AICMode>;
}

const AICModeContext = createContext<AICModeContextType | undefined>(undefined);

export const AICModeProvider: React.FC<{
	children: ReactNode;
	app: App;
}> = ({ children, app }) => {
	const defaultMode = getDefaultAICMode();
	const [aicModes, setAICModes] = useState<Record<string, AICMode>>({
		default: defaultMode,
	});
	const [activeModeId, setActiveModeId] = useState<string>("default");
	const [fileEventRefs, setFileEventRefs] = useState<EventRef[]>([]);
	const [modeFilePaths, setModeFilePaths] = useState<Set<string>>(new Set());
	const textToSpeech = useTextToSpeech();

	// Function to extract an AIC mode from a file with the #aic-mode tag
	const extractAICModeFromFile = async (
		file: TFile,
	): Promise<AICMode | null> => {
		try {
			const content = await app.vault.read(file);

			// Check if content is valid
			if (content.trim().length === 0) {
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
	

	

	// Helper to set the active mode
	const setActiveMode = useCallback(
		(mode: AICMode | null) => {
			if (!mode) {
				setActiveModeId("default");

				// Update text-to-speech settings for the default mode
				const defaultMode = getDefaultAICMode();
				textToSpeech.setTTSSettings({
					enabled: defaultMode.aic_voice_autoplay,
					voice: defaultMode.aic_voice,
					instructions: defaultMode.aic_voice_instructions,
					speed: defaultMode.aic_voice_speed,
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
		defaultAICMode: getDefaultAICMode(),
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
