import { getStore } from './plugin-store';

/**
 * Initialize settings store from plugin data
 */
export async function initializeSettingsStore(): Promise<void> {
  
  try {
    getStore().setSettingsLoading(true);
    
    // Load settings from plugin data using the new slice-based approach
    await getStore().loadSettings();
    
    getStore().refreshSetupState();
    
    console.log('Settings store initialized');
  } finally {
    getStore().setSettingsLoading(false);
  }
}
