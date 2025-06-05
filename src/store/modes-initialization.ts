import { TFile, EventRef } from 'obsidian';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { getStore } from './plugin-store';
import { getPrebuiltModes } from 'src/utils/modes/prebuilt-modes';
import { extractLNModeFromFile } from 'src/utils/modes/extract-mode-from-file';
import { hasModeTag } from 'src/utils/modes/has-mode-tag';
import { LNMode } from '../types/LNMode';

// Store event references for cleanup
let fileEventRefs: EventRef[] = [];
let modeFilePathsSet = new Set<string>();
let loadLNModesTimeout: NodeJS.Timeout | null = null;

/**
 * Initialize modes store and setup file watching
 */
export async function initializeModesStore(): Promise<void> {
  const state = getStore();
  
  try {
    state.setModesLoading(true);
    
    // Load all modes
    await loadLNModes();
    
    // Setup file watchers for mode files
    setupModeFileWatchers();
    
    console.debug('Modes store initialized');
  } finally {
    state.setModesLoading(false);
  }
}

/**
 * Load all LN modes from files and prebuilt modes
 */
async function loadLNModes(): Promise<void> {
  const state = getStore();
  
  try {
    // Get all markdown files in the vault
    const files = LifeNavigatorPlugin.getInstance().app.vault.getMarkdownFiles();
    const modesMap: Record<string, LNMode> = {};

    // First, add all pre-built modes
    const prebuiltModes = getPrebuiltModes();
    for (const mode of prebuiltModes) {
      if (mode.ln_path) {
        modesMap[mode.ln_path] = mode;
      }
    }

    // Then add file-based modes
    for (const file of files) {
      const mode = await extractLNModeFromFile(LifeNavigatorPlugin.getInstance().app, file);
      if (mode && mode.ln_path) {
        modesMap[mode.ln_path] = mode;
      }
    }

    // Update modes in store
    state.setAvailableModes(modesMap);
    
    // Update mode file paths (only include file-based modes)
    const fileModeKeys = Object.keys(modesMap).filter((path) => path !== "" && !path.startsWith(':prebuilt:'));
    modeFilePathsSet = new Set(fileModeKeys);
    
    console.debug(
      `Loaded ${Object.keys(modesMap).length} modes (${prebuiltModes.length} pre-built, ${Object.keys(modesMap).length - prebuiltModes.length} from files)`
    );
    
    // Set the active mode from settings, regardless of whether it exists yet
    // This preserves user's choice and allows UI to show loading state if needed
    const store = getStore();
    const desiredModeId = store.settings.activeModeId;
    
    if (desiredModeId) {
      // Always set the user's desired mode - UI will handle loading state if mode doesn't exist
      state.setActiveMode(desiredModeId);
    } else if (Object.keys(modesMap).length > 0) {
      // No preference set - use first available mode
      const firstModeId = Object.keys(modesMap)[0] || "";
      state.setActiveMode(firstModeId);
    }
  } catch (error) {
    console.error("Error loading LN modes:", error);
  }
}

/**
 * Debounced version of loadLNModes to prevent excessive reloading
 */
function debouncedLoadLNModes(delay: number = 300): void {
  if (loadLNModesTimeout) {
    clearTimeout(loadLNModesTimeout);
  }
  
  loadLNModesTimeout = setTimeout(() => {
    loadLNModes();
    loadLNModesTimeout = null;
  }, delay);
}

/**
 * Setup file watchers for mode files
 */
function setupModeFileWatchers(): void {
  const state = getStore();
  
  // Clean up existing event references
  fileEventRefs.forEach((ref) => LifeNavigatorPlugin.getInstance().app.vault.offref(ref));
  fileEventRefs = [];
  
  // When a file is created
  const createRef = LifeNavigatorPlugin.getInstance().app.vault.on("create", (file) => {
    if (file instanceof TFile && file.extension === "md") {
      // Wait for metadata to be indexed
      setTimeout(() => {
        if (hasModeTag(file)) {
          debouncedLoadLNModes();
        }
      }, 100);
    }
  });
  fileEventRefs.push(createRef);

  // When a file is modified
  const modifyRef = LifeNavigatorPlugin.getInstance().app.vault.on("modify", (file) => {
    if (file instanceof TFile && file.extension === "md") {
      // Check if this file had or has the tag
      const hadTag = modeFilePathsSet.has(file.path);

      // Wait for metadata to be indexed
      setTimeout(() => {
        const hasTag = hasModeTag(file);
        if (hadTag || hasTag) {
          debouncedLoadLNModes();
        }
      }, 100);
    }
  });
  fileEventRefs.push(modifyRef);

  // When a file is deleted
  const deleteRef = LifeNavigatorPlugin.getInstance().app.vault.on("delete", (file) => {
    if (file instanceof TFile && file.extension === "md") {
      // Check if this was a mode file
      const wasMode = modeFilePathsSet.has(file.path);
      console.debug(`File deleted: ${file.path}, was mode: ${wasMode}`);
      
      if (wasMode) {
        console.debug("Reloading modes after mode file deletion");
        debouncedLoadLNModes();
      }
    }
  });
  fileEventRefs.push(deleteRef);

  // When a file is renamed
  const renameRef = LifeNavigatorPlugin.getInstance().app.vault.on("rename", (file, oldPath) => {
    if (file instanceof TFile && file.extension === "md") {
      // Check if this was a mode file
      const wasMode = modeFilePathsSet.has(oldPath);
      
      if (wasMode) {
        debouncedLoadLNModes();
      } else {
        // Wait for metadata to be indexed
        setTimeout(() => {
          if (hasModeTag(file)) {
            debouncedLoadLNModes();
          }
        }, 100);
      }
    }
  });
  fileEventRefs.push(renameRef);

  // When metadata is changed
  const metadataRef = LifeNavigatorPlugin.getInstance().app.metadataCache.on("changed", (file) => {
    if (file instanceof TFile && file.extension === "md") {
      // Check if this file had the tag before
      const hadTag = modeFilePathsSet.has(file.path);
      const hasTag = hasModeTag(file);

      // Only reload if tag status changed
      if (hadTag !== hasTag) {
        debouncedLoadLNModes();
      }
    }
  });
  fileEventRefs.push(metadataRef);
  
  state.setFileWatcherActive(true);
  console.debug('Mode file watchers set up');
}

/**
 * Handle mode changes from external sources and persist to settings
 */
export async function handleModeChange(modeId: string): Promise<void> {
  const store = getStore();
  store.setActiveMode(modeId);
  
  // Save to plugin settings
  store.updateSettings({ activeModeId: modeId });
  await store.saveSettings();
}

/**
 * Get current active mode
 */
export function getCurrentActiveMode(): LNMode | null {
  const state = getStore();
  const currentState = state.modes;
  return currentState.available[currentState.activeId] || null;
}

/**
 * Get all available modes
 */
export function getAllModes(): Record<string, LNMode> {
  const state = getStore();
  return state.modes.available;
}

/**
 * Clean up modes-related resources
 */
export function cleanupModesStore(): void {
  const state = getStore();
  
  // Clear any pending debounced load
  if (loadLNModesTimeout) {
    clearTimeout(loadLNModesTimeout);
    loadLNModesTimeout = null;
  }
  
  // Clean up file event listeners
  fileEventRefs.forEach((ref) => {
    const plugin = LifeNavigatorPlugin.getInstance();
    if (plugin?.app?.vault) {
      plugin.app.vault.offref(ref);
    }
  });
  fileEventRefs = [];
  
  // Clear file paths set
  modeFilePathsSet.clear();
  
  state.setFileWatcherActive(false);
  console.debug('Modes store cleanup completed');
} 