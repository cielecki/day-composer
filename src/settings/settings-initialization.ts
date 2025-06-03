import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { getStoreState } from '../store/plugin-store';
import { loadPluginSettings } from './LifeNavigatorSettings';

/**
 * Initialize settings store from plugin data
 */
export async function initializeSettingsStore(plugin: LifeNavigatorPlugin): Promise<void> {
  const state = getStoreState();
  
  try {
    state.setSettingsLoading(true);
    
    // Load settings from plugin data
    const settings = await loadPluginSettings(plugin);
    state.setSettings(settings);
    
    // Load secrets from plugin data
    state.setSecrets(settings.secrets || {});

    state.refreshSetupState();
    
    console.log('Settings store initialized');
  } finally {
    state.setSettingsLoading(false);
  }
}

/**
 * Handle settings updates from external sources
 */
export async function handleSettingsUpdate(plugin: LifeNavigatorPlugin): Promise<void> {
  try {
    const { setSettingsLoading, setSettings } = getStoreState();
    setSettingsLoading(true);
    
    const settings = await loadPluginSettings(plugin);
    setSettings(settings);
  } catch (error) {
    console.error('Failed to update settings:', error);
  } finally {
    const { setSettingsLoading } = getStoreState();
    setSettingsLoading(false);
  }
}

/**
 * Clean up settings-related resources
 */
export function cleanupSettingsStore(): void {
  // Settings cleanup if needed in the future
  console.log('Settings store cleanup completed');
} 