import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
	useCallback,
	useRef,
} from "react";
import { LNMode } from "../types/types";
import { App, TFile, EventRef } from "obsidian";
import {
	mergeWithDefaultMode,
	getDefaultLNMode,
} from "../utils/mode/ln-mode-defaults";
import * as yaml from "js-yaml";
import { t } from '../i18n';
import { getPluginSettings } from "../settings/PluginSettings";
import { modeManagerService } from "../services/ModeManagerService";
import { DEFAULT_VOICE_INSTRUCTIONS } from "../utils/mode/ln-mode-defaults";



export interface LNModeContextType {
	setActiveModeId: (modeId: string) => Promise<void>;
	loadLNModes: () => Promise<void>;
	defaultLNMode: Partial<LNMode>;
	lnModesRef: React.RefObject<Record<string, LNMode>>;
	activeModeIdRef: React.RefObject<string>;
}

const LNModeContext = createContext<LNModeContextType | undefined>(undefined);

export const LNModeProvider: React.FC<{
	children: ReactNode;
	app: App;
}> = ({ children, app }) => {
	const defaultMode = getDefaultLNMode();
	const settings = getPluginSettings();
	
	// Use refs for always getting current values (no stale closures)
	const lnModesRef = useRef<Record<string, LNMode>>({
		default: defaultMode,
	});
	const activeModeIdRef = useRef<string>(settings.activeModeId);
	
	// State for triggering re-renders and other state that needs reactivity
	const [, setForceUpdate] = useState(0);
	const [fileEventRefs, setFileEventRefs] = useState<EventRef[]>([]);
	// Use ref instead of state to avoid stale closures in event handlers
	const modeFilePathsRef = useRef<Set<string>>(new Set());

	// Function to extract an LN mode from a file with the #ln-mode tag
	const extractLNModeFromFile = async (
		file: TFile,
	): Promise<LNMode | null> => {
		try {
			const content = await app.vault.read(file);

			// Check if content is valid
			if (content.trim().length === 0) {
				return null;
			}

			// Check if file has #ln-mode tag
			const cache = app.metadataCache.getFileCache(file);
			const tags = cache?.tags?.map((tag) => tag.tag) || [];
			const frontmatterTags = cache?.frontmatter?.tags || [];

			// Convert frontmatter tags to array if it's a string
			const normalizedFrontmatterTags = Array.isArray(frontmatterTags)
				? frontmatterTags
				: [frontmatterTags];

			// Check if the file has the #ln-mode tag
			const hasModeTag =
				tags.includes("#ln-mode") ||
				normalizedFrontmatterTags.includes("ln-mode");

			if (!hasModeTag) {
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
				const partialMode: Partial<LNMode> = {
					ln_name: file.basename,
					ln_path: file.path,
					ln_system_prompt: content.trim(),
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
			// Create a partial LNMode object
			const partialMode: Partial<LNMode> = {
				// Required fields
				ln_name: file.basename,
				ln_path: file.path,

				// UI elements
				ln_icon: frontmatter.ln_icon,
				ln_icon_color: frontmatter.ln_icon_color,
				ln_description: frontmatter.ln_description,

				// Behavior
				ln_example_usages: Array.isArray(
					frontmatter.ln_example_usages,
				)
					? frontmatter.ln_example_usages
					: frontmatter.ln_example_usages
						? [frontmatter.ln_example_usages]
						: [],



				// API parameters
				ln_model: frontmatter.ln_model,
				ln_thinking_budget_tokens:
					frontmatter.ln_thinking_budget_tokens !== undefined
						? parseInt(
								String(frontmatter.ln_thinking_budget_tokens),
							)
						: undefined,
				ln_max_tokens:
					frontmatter.ln_max_tokens !== undefined
						? parseInt(String(frontmatter.ln_max_tokens))
						: undefined,

				// TTS settings
				ln_voice_autoplay:
					frontmatter.ln_voice_autoplay !== undefined
						? String(
								frontmatter.ln_voice_autoplay,
							).toLowerCase() === "true"
						: undefined,
				ln_voice: frontmatter.ln_voice,
				ln_voice_instructions: frontmatter.ln_voice_instructions,
				ln_voice_speed:
					frontmatter.ln_voice_speed !== undefined
						? parseFloat(String(frontmatter.ln_voice_speed))
						: undefined,

				// Tool filtering
				ln_tools_allowed: Array.isArray(frontmatter.ln_tools_allowed)
					? frontmatter.ln_tools_allowed
					: frontmatter.ln_tools_allowed
						? [frontmatter.ln_tools_allowed]
						: undefined,
				ln_tools_disallowed: Array.isArray(frontmatter.ln_tools_disallowed)
					? frontmatter.ln_tools_disallowed
					: frontmatter.ln_tools_disallowed
						? [frontmatter.ln_tools_disallowed]
						: undefined,
			};

			partialMode.ln_system_prompt = contentStr;

			// Merge with defaults and return
			return mergeWithDefaultMode(partialMode);
		} catch (error) {
			console.error(`Error reading file ${file.path}:`, error);
			return null;
		}
	};

	const loadLNModes = useCallback(async () => {
		try {
			// Get all markdown files in the vault
			const files = app.vault.getMarkdownFiles();
			const modesMap: Record<string, LNMode> = {};

			for (const file of files) {
				const mode = await extractLNModeFromFile(file);
				if (mode && mode.ln_path) {
					modesMap[mode.ln_path] = mode;
				}
			}

			lnModesRef.current = modesMap;
			
			// Update mode file paths ref
			modeFilePathsRef.current = new Set(Object.keys(modesMap).filter((path) => path !== ""));
			
			setForceUpdate(prev => prev + 1);
			console.log(
				`Loaded ${Object.keys(modesMap).length} modes with #ln-mode tag`
			);
			// If active mode no longer exists, set it to the first available mode
			if (!modesMap[activeModeIdRef.current] && Object.keys(modesMap).length > 0) {
				const firstModeId = Object.keys(modesMap)[0] || "";
				activeModeIdRef.current = firstModeId;
				setForceUpdate(prev => prev + 1);
				settings.activeModeId = firstModeId;
				await settings.saveSettings();
			}
		} catch (error) {
			console.error("Error loading LN modes:", error);
		}
	}, [app, activeModeIdRef, settings]);

	// Setup vault event listeners
	useEffect(() => {
		// Clean up existing event references
		return () => {
			fileEventRefs.forEach((ref) => app.vault.offref(ref));
		};
	}, [app, fileEventRefs]);

	// Helper to check if file has or had the #ln-mode tag
	const hasModeTag = (file: TFile): boolean => {
		const cache = app.metadataCache.getFileCache(file);
		const tags = cache?.tags?.map((tag) => tag.tag) || [];
		const frontmatterTags = cache?.frontmatter?.tags || [];

		// Convert frontmatter tags to array if it's a string
		const normalizedFrontmatterTags = Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];

		return (
			tags.includes("#ln-mode") ||
			normalizedFrontmatterTags.includes("ln-mode")
		);
	};

	// Register file event handlers - simplified dependencies to avoid recreation
	useEffect(() => {
		const refs: EventRef[] = [];

		// When a file is created
		const createRef = app.vault.on("create", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				console.log("File created:", file.path);
				// Wait for metadata to be indexed
				setTimeout(() => {
					if (hasModeTag(file)) {
						loadLNModes();
					}
				}, 100);
			}
		});
		refs.push(createRef);

		// When a file is modified
		const modifyRef = app.vault.on("modify", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				// Check if this file had or has the tag using current ref value
				const hadTag = modeFilePathsRef.current.has(file.path);

				// Wait for metadata to be indexed
				setTimeout(() => {
					const hasTag = hasModeTag(file);
					if (hadTag || hasTag) {
						loadLNModes();
					}
				}, 100);
			}
		});
		refs.push(modifyRef);

		// When a file is deleted
		const deleteRef = app.vault.on("delete", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				// Check if this was a mode file using current ref value
				const wasMode = modeFilePathsRef.current.has(file.path);
				console.log(`File deleted: ${file.path}, was mode: ${wasMode}`);
				
				if (wasMode) {
					console.log("Reloading modes after mode file deletion");
					loadLNModes();
				}
			}
		});
		refs.push(deleteRef);

		// When a file is renamed
		const renameRef = app.vault.on("rename", (file, oldPath) => {
			if (file instanceof TFile && file.extension === "md") {
				// Check if this was a mode file using current ref value
				const wasMode = modeFilePathsRef.current.has(oldPath);
				
				if (wasMode) {
					loadLNModes();
				} else {
					// Wait for metadata to be indexed
					setTimeout(() => {
						if (hasModeTag(file)) {
							loadLNModes();
						}
					}, 100);
				}
			}
		});
		refs.push(renameRef);

		// When metadata is changed
		const metadataRef = app.metadataCache.on("changed", (file) => {
			if (file instanceof TFile && file.extension === "md") {
				// Check if this file had the tag before using current ref value
				const hadTag = modeFilePathsRef.current.has(file.path);
				const hasTag = hasModeTag(file);

				// Only reload if tag status changed
				if (hadTag !== hasTag) {
					loadLNModes();
				}
			}
		});
		refs.push(metadataRef);

		setFileEventRefs(refs);

		return () => {
			refs.forEach((ref) => app.vault.offref(ref));
		};
	}, [app, loadLNModes]); // Removed modeFilePaths from dependencies

	// Load modes when component mounts
	useEffect(() => {
		loadLNModes();
	}, [loadLNModes]);

	// Helper to set the active mode
	const setActiveModeId = useCallback(
		async (modeId: string) => {
			console.log("Setting active mode:", modeId);
			activeModeIdRef.current = modeId;
			setForceUpdate(prev => prev + 1);
			
			// Save to plugin settings
			settings.activeModeId = modeId;
			await settings.saveSettings();
		},
		[settings],
	);

	// Register bridge with ModeManagerService for external access
	useEffect(() => {
		modeManagerService.registerContextBridge({
			setActiveModeId: setActiveModeId,
			getCurrentModes: () => lnModesRef.current,
			getActiveModeId: () => activeModeIdRef.current,
		});

		// Cleanup: unregister when component unmounts
		return () => {
			modeManagerService.unregisterContextBridge();
		};
	}, [setActiveModeId, lnModesRef, activeModeIdRef]);

	// Context value that provides the modes and functionality
	const contextValue: LNModeContextType = {
		lnModesRef: lnModesRef,
		activeModeIdRef: activeModeIdRef,
		setActiveModeId,
		loadLNModes: loadLNModes,
		defaultLNMode: getDefaultLNMode(),
	};

	return (
		<LNModeContext.Provider value={contextValue}>
			{children}
		</LNModeContext.Provider>
	);
};

// Custom hook for using the LN Mode context
export const useLNMode = () => {
	const context = useContext(LNModeContext);
	if (context === undefined) {
		throw new Error("useLNMode must be used within an LNModeProvider");
	}
	return context;
};
