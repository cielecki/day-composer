import { initializeSettingsStore } from 'src/settings/settings-initialization';
import { initializeChatFeatures } from '../chat/chat-initialization';
import { initializeModesStore } from 'src/modes/modes-initialization';

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
    // Initialize all domain slices in parallel

    await initializeModesStore()
    await initializeSettingsStore()
    await initializeChatFeatures()
    
    console.log('Store initialization complete');
  } catch (error) {
    console.error('Failed to initialize store:', error);
    throw error;
  }
}
