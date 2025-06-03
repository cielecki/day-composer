import { TFile } from 'obsidian';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { getStoreState } from '../store/plugin-store';
import { getPluginSettings } from '../settings/LifeNavigatorSettings';

/**
 * Initialize modes store and setup file watching
 */
export async function initializeModesStore(plugin: LifeNavigatorPlugin): Promise<void> {
  const state = getStoreState();
  
  try {
    state.setModesLoading(true);
    
    // Load modes - for now just initialize empty
    // TODO: Implement mode loading when mode management is migrated
    state.setAvailableModes({});
    
    // Get current settings to check for active mode
    const settings = getPluginSettings();
    if (settings?.activeModeId) {
      state.setActiveMode(settings.activeModeId);
    }
    
    // Setup file watchers for mode files
    setupModeFileWatchers(plugin);
    
    console.log('Modes store initialized');
  } finally {
    state.setModesLoading(false);
  }
}

/**
 * Setup file watchers for mode files
 */
function setupModeFileWatchers(plugin: LifeNavigatorPlugin): void {
  const state = getStoreState();
  
  // File modification handler
  const handleFileModify = async (file: TFile) => {
    if (file.path.includes('#ln-mode')) {
      try {
        const { setModesLoading } = getStoreState();
        setModesLoading(true);
        
        // TODO: Reload modes when mode files change
        // This will be implemented when mode management is migrated
        console.log('Mode file changed:', file.path);
        
      } catch (error) {
        console.error('Failed to reload modes after file change:', error);
      } finally {
        const { setModesLoading } = getStoreState();
        setModesLoading(false);
      }
    }
  };
  
  // File creation handler
  const handleFileCreate = async (file: TFile) => {
    if (file.path.includes('#ln-mode')) {
      await handleFileModify(file);
    }
  };
  
  // File deletion handler
  const handleFileDelete = async (file: TFile) => {
    if (file.path.includes('#ln-mode')) {
      await handleFileModify(file);
    }
  };
  
  // Register event handlers
  plugin.registerEvent(
    plugin.app.vault.on('modify', handleFileModify)
  );
  
  plugin.registerEvent(
    plugin.app.vault.on('create', handleFileCreate)
  );
  
  plugin.registerEvent(
    plugin.app.vault.on('delete', handleFileDelete)
  );
  
  state.setFileWatcherActive(true);
  console.log('Mode file watchers set up');
}

/**
 * Handle mode changes from external sources
 */
export function handleModeChange(modeId: string): void {
  const { setActiveMode } = getStoreState();
  setActiveMode(modeId);
}

/**
 * Clean up modes-related resources
 */
export function cleanupModesStore(): void {
  const state = getStoreState();
  state.setFileWatcherActive(false);
  console.log('Modes store cleanup completed');
} 