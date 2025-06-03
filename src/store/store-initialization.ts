import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { initializeModesStore, cleanupModesStore } from '../modes/modes-initialization';
import { initializeSettingsStore, cleanupSettingsStore } from '../settings/settings-initialization';
import { initializeChatStore, cleanupChatStore } from '../chat/chat-initialization';
import { initializeTTS, cleanupTTS } from '../tts/tts-initialization';
import { initializeSTT, cleanupSTT } from '../stt/stt-initialization';
import { initializeUIStore, cleanupUIStore } from '../ui/ui-initialization';

/**
 * Initialize all store slices and their domain-specific logic
 */
export async function initializeStore(plugin: LifeNavigatorPlugin): Promise<void> {
  console.log('Initializing Zustand store and domain logic...');
  
  try {
    // Initialize all domain slices in parallel
    await Promise.all([
      initializeModesStore(plugin),
      initializeSettingsStore(plugin),
      initializeChatStore(plugin),
      initializeTTS(plugin),
      initializeSTT(plugin),
      initializeUIStore(plugin)
    ]);
    
    console.log('Store initialization complete');
  } catch (error) {
    console.error('Failed to initialize store:', error);
    throw error;
  }
}

/**
 * Cleanup all store slices and their domain-specific logic
 */
export function cleanupStore(plugin: LifeNavigatorPlugin): void {
  console.log('Cleaning up Zustand store and domain logic...');
  
  try {
    // Cleanup all domain slices
    cleanupModesStore();
    cleanupSettingsStore();
    cleanupChatStore();
    cleanupTTS();
    cleanupSTT();
    cleanupUIStore();
    
    console.log('Store cleanup complete');
  } catch (error) {
    console.error('Failed to cleanup store:', error);
  }
}

/**
 * Subscribe to store changes for persistence
 */
export function setupStorePersistence(plugin: LifeNavigatorPlugin): void {
  // This could be used to automatically save settings when they change
  // For now, we'll rely on manual save operations
} 