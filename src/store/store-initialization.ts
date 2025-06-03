import { initializeSettingsStore } from 'src/settings/settings-initialization';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { initializeChatFeatures, cleanupChatFeatures } from '../chat/chat-initialization';
import { initializeModesStore } from 'src/modes/modes-initialization';
import { initializeSTT } from 'src/stt/stt-initialization';
import { initializeTTS } from 'src/tts/tts-initialization';

let initialized = false;

/**
 * Initialize the Zustand store with plugin instance
 */
export async function initializeStore(plugin: LifeNavigatorPlugin): Promise<void> {
  if (initialized) {
    console.warn('Store already initialized');
    return;
  }

  try {
    // Initialize all domain slices in parallel

    await initializeModesStore(plugin)
    await initializeSettingsStore(plugin)
    await initializeChatFeatures(plugin)
    await initializeTTS(plugin)
    await initializeSTT(plugin)
    
    console.log('Store initialization complete');
  } catch (error) {
    console.error('Failed to initialize store:', error);
    throw error;
  }
}

/**
 * Clean up store resources
 */
export function cleanupStore(): void {
  if (!initialized) {
    return;
  }

  try {
    cleanupChatFeatures();
    initialized = false;
    console.log('Store cleanup completed');
  } catch (error) {
    console.error('Error during store cleanup:', error);
  }
} 