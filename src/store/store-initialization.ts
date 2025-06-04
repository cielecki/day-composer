import { initializeSettingsStore } from './settings-initialization';
import { initializeChatFeatures } from './chat-initialization';
import { initializeModesStore } from './modes-initialization';

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
