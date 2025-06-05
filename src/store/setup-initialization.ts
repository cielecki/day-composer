import { getStore } from './plugin-store';

let unsubscribeSetupChanges: (() => void) | null = null;

/**
 * Initialize setup state monitoring
 * This sets up subscriptions to automatically refresh setup state when relevant data changes
 */
export async function initializeSetupStore(): Promise<void> {
  try {
    const store = getStore();
    
    // Set up subscriptions to automatically refresh setup state when relevant data changes
    unsubscribeSetupChanges = store.subscribeToSetupChanges();
    
    console.log('Setup store initialized with automatic state monitoring');
  } catch (error) {
    console.error('Failed to initialize setup store:', error);
    throw error;
  }
}

/**
 * Clean up setup-related resources
 */
export function cleanupSetupStore(): void {
  if (unsubscribeSetupChanges) {
    unsubscribeSetupChanges();
    unsubscribeSetupChanges = null;
    console.log('Setup store cleanup completed');
  }
} 