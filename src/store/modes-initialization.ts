import { TFile } from 'obsidian';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { getStore } from './plugin-store';
import { getPrebuiltModes } from '../utils/modes/prebuilt-modes';
import { extractLNModeFromFile } from '../utils/modes/extract-mode-from-file';
import { LNMode } from '../types/mode';
import { validateModeFile } from '../utils/validation/mode-validation';
import { FileWatcher } from '../utils/fs/file-watcher';

// File watcher instance for modes
let modeFileWatcher: FileWatcher | null = null;

/**
 * Initialize modes store and setup file watching
 */
export async function initializeModesStore(): Promise<void> {
  const state = getStore();
  
  try {
    state.setModesLoading(true);
    
    // Load all modes
    await loadLNModes();
    
    // Setup file watcher for mode files
    setupModeFileWatcher();
    
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
  
  // Clear previous validation errors
  state.clearModeValidationErrors();
  
  try {
    // Get all markdown files in the vault
    const files = LifeNavigatorPlugin.getInstance().app.vault.getMarkdownFiles();
    const modesMap: Record<string, LNMode> = {};
    const invalidModes: string[] = [];

    // First, add all pre-built modes
    const prebuiltModes = getPrebuiltModes();
    for (const mode of prebuiltModes) {
      if (mode.path) {
        modesMap[mode.path] = mode;
      }
    }

    // Then add file-based modes and validate them
    for (const file of files) {
      // Get metadata for validation
      const metadata = LifeNavigatorPlugin.getInstance().app.metadataCache.getFileCache(file);
      
      // Check if this is a mode file
      if (metadata?.frontmatter?.tags?.includes('ln-mode')) {
        // Read content for thorough validation
        const content = await LifeNavigatorPlugin.getInstance().app.vault.read(file);
        

        
        // Validate the mode file
        const validation = await validateModeFile(file, metadata, content);
        
        if (!validation.isValid) {
          // Track invalid mode
          invalidModes.push(file.path);
        }
        
        // Still try to extract and load the mode (even if invalid)
        const mode = await extractLNModeFromFile(LifeNavigatorPlugin.getInstance().app, file);
        if (mode && mode.path) {
          modesMap[mode.path] = mode;
        }
      }
    }

    // Update modes in store
    state.setAvailableModes(modesMap);
    
    // Update validation state
    state.setInvalidModes(invalidModes);
    
    // Update mode file paths (only include file-based modes)
    const fileModeKeys = Object.keys(modesMap).filter((path) => path !== "" && !path.startsWith(':prebuilt:'));
    
    // Update file watcher with tracked paths
    if (modeFileWatcher) {
      modeFileWatcher.updateTrackedPaths(fileModeKeys);
    }
    
    console.debug(
      `Loaded ${Object.keys(modesMap).length} modes (${prebuiltModes.length} pre-built, ${Object.keys(modesMap).length - prebuiltModes.length} from files)`
    );
    
    if (invalidModes.length > 0) {
      console.warn(`Found ${invalidModes.length} invalid modes:`, invalidModes);
    }
    

    
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
 * Setup file watcher for mode files using the shared FileWatcher utility
 */
function setupModeFileWatcher(): void {
  const state = getStore();
  
  // Clean up existing watcher if any
  if (modeFileWatcher) {
    modeFileWatcher.stop();
  }
  
  // Create new file watcher
  modeFileWatcher = new FileWatcher({
    tag: 'ln-mode',
    reloadFunction: loadLNModes,
    debounceDelay: 2000,
    debugPrefix: 'MODES'
  });
  
  // Start watching
  modeFileWatcher.start();
  
  state.setFileWatcherActive(true);
  console.debug('Mode file watcher set up');
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
  
  // Stop file watcher
  if (modeFileWatcher) {
    modeFileWatcher.stop();
    modeFileWatcher = null;
  }
  
  state.setFileWatcherActive(false);
  console.debug('Modes store cleanup completed');
} 