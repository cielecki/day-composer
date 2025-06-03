import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { getStoreState } from '../store/plugin-store';

/**
 * Initialize UI store
 */
export async function initializeUIStore(plugin: LifeNavigatorPlugin): Promise<void> {
  const state = getStoreState();
  
  // Initialize UI state - already has proper defaults
  // Could check setup completion status here in the future
  
  console.log('UI store initialized');
}

/**
 * Clean up UI-related resources
 */
export function cleanupUIStore(): void {
  const state = getStoreState();
  
  // Reset UI to clean state
  state.resetUI();
  
  console.log('UI store cleanup completed');
} 