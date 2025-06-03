import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { getStoreState } from '../store/plugin-store';

/**
 * Initialize conversation store
 */
export async function initializeChatStore(plugin: LifeNavigatorPlugin): Promise<void> {
  const state = getStoreState();
  
  // Initialize with empty conversation
  // The conversation slice already has proper defaults
  
  console.log('Conversation store initialized');
}

/**
 * Handle conversation updates from external sources
 */
export function handleChatUpdate(): void {
  const { incrementChatVersion } = getStoreState();
  incrementChatVersion();
}

/**
 * Clean up conversation-related resources
 */
export function cleanupChatStore(): void {
  const state = getStoreState();
  state.clearLiveToolResults();
  console.log('Conversation store cleanup completed');
} 