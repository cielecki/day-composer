import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { usePluginStore, getStore } from '../store/plugin-store';

let autoSaveTimeout: NodeJS.Timeout | null = null;

/**
 * Initialize chat functionality with auto-save and other features
 */
export async function initializeChatFeatures(): Promise<void> {
  setupAutoSave();
  console.log('Chat features initialized');
}

/**
 * Cleanup chat functionality
 */
export function cleanupChatFeatures(): void {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  console.log('Chat features cleaned up');
}

/**
 * Set up auto-save functionality that matches AIAgentContext behavior
 */
function setupAutoSave(): void {
  // Subscribe to conversation changes
  usePluginStore.subscribe(
    (state) => ({
      conversationVersion: state.chats.conversationVersion,
      isGenerating: state.chats.isGenerating,
      messages: state.chats.current.storedConversation.messages
    }),
    (currentState, previousState) => {
      // Trigger auto-save when conversation version changes
      if (currentState.conversationVersion !== previousState?.conversationVersion) {
        // Clear previous timeout
        if (autoSaveTimeout) {
          clearTimeout(autoSaveTimeout);
        }
        
        // Set up debounced auto-save (2 seconds like AIAgentContext)
        autoSaveTimeout = setTimeout(async () => {
          const state = getStore();
          
          // Only auto-save if not generating and has messages
          if (!state.chats.isGenerating && state.chats.current.storedConversation.messages.length > 0) {
            try {
              // Use the store's auto-save action
              await state.autoSaveConversation(state.chats.isGenerating);
              console.log('Auto-saved conversation after 2s delay');
            } catch (error) {
              console.error('Failed to auto-save conversation:', error);
            }
          }
        }, 2000);
      }
    }
  );
}

/**
 * Handle conversation updates from external sources
 */
export function handleChatUpdate(): void {
  const { incrementChatVersion } = getStore();
  incrementChatVersion();
} 