import { initializeSettingsStore } from './settings-initialization';
import { initializeChatFeatures } from './chat-initialization';
import { initializeModesStore } from './modes-initialization';
import { initializeSetupStore } from './setup-initialization';
import { cleanupModesStore } from './modes-initialization';
import { cleanupChatFeatures } from './chat-initialization';
import { cleanupSetupStore } from './setup-initialization';

let initialized = false;

/**
 * Initialize the Zustand store with plugin instance
 */
export async function initializeStore(): Promise<void> {
  if (initialized) {
    console.warn('Store already initialized');
    return;
  }

  try {
    // Initialize settings first to ensure secrets are loaded before other initialization
    // that might call saveSettings()
    await initializeSettingsStore()
    
    // Initialize setup state monitoring (depends on settings being loaded)
    await initializeSetupStore()
    
    // Then initialize modes (which may call saveSettings if active mode needs to be updated)
    await initializeModesStore()
    
    // Finally initialize chat features
    await initializeChatFeatures()
    
    initialized = true;
    console.log('Store initialization complete');
  } catch (error) {
    console.error('Failed to initialize store:', error);
    throw error;
  }
}

/**
 * Clean up the store and all its resources
 */
export function cleanupStore(): void {
  if (!initialized) {
    console.warn('Store not initialized, nothing to cleanup');
    return;
  }

  try {
    // Clean up in reverse order of initialization
    cleanupChatFeatures();
    cleanupModesStore();
    cleanupSetupStore();
    // Note: settings don't need cleanup as they have no persistent resources
    
    initialized = false;
    console.log('Store cleanup complete');
  } catch (error) {
    console.error('Error during store cleanup:', error);
  }
}
