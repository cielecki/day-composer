import { LifeNavigatorPlugin } from '../../LifeNavigatorPlugin';
import { usePluginStore } from '../../store/plugin-store';
import { LIFE_NAVIGATOR_VIEW_TYPE, ChatView } from '../../views/chat-view';

export type ChatDelegationOptions = {
  /** The mode ID to delegate to (e.g., ':prebuilt:guide') */
  targetModeId: string;
  /** The message to send to the target mode */
  message: string;
  /** Current chat ID to check if empty (optional) */
  currentChatId?: string;
  /** Optional title for new chat */
  title?: string;
  /** Force creation of new chat even if current is empty */
  forceNewChat?: boolean;
};

/**
 * Unified chat delegation utility that handles the pattern of:
 * - If current chat is empty: switch mode and use current chat
 * - If current chat has messages: create new chat and switch to it
 * - Always ensures user sees the target chat
 * - Triggers AI processing automatically
 * 
 * @param options Chat delegation configuration
 * @returns Promise<string> The chat ID that was used (current or new)
 */
export async function delegateToModeOrCurrentChat(options: ChatDelegationOptions): Promise<string> {
  const { targetModeId, message, currentChatId, title, forceNewChat = false } = options;
  const store = usePluginStore.getState();
  const plugin = LifeNavigatorPlugin.getInstance();

  if (!plugin) {
    throw new Error('Plugin instance not available');
  }

  let targetChatId: string;
  let shouldSwitchChat = false;

  // Determine if we should use current chat or create new one
  if (!forceNewChat && currentChatId) {
    const currentChatState = store.getChatState(currentChatId);
    const isEmpty = !currentChatState || currentChatState.chat.storedConversation.messages.length === 0;
    
    if (isEmpty) {
      // Use current empty chat - switch its mode
      targetChatId = currentChatId;
      store.setActiveModeForChat(currentChatId, targetModeId);
      console.debug(`Using current empty chat ${currentChatId} and switching to mode ${targetModeId}`);
    } else {
      // Current chat has messages - create new chat
      targetChatId = store.createNewChat(targetModeId);
      shouldSwitchChat = true;
      console.debug(`Current chat ${currentChatId} has messages, created new chat ${targetChatId} with mode ${targetModeId}`);
    }
  } else {
    // No current chat or forced new chat - create new one
    targetChatId = store.createNewChat(targetModeId);
    shouldSwitchChat = true;
    console.debug(`Created new chat ${targetChatId} with mode ${targetModeId}`);
  }

  // Save current conversation before switching (if applicable)
  if (shouldSwitchChat && currentChatId) {
    try {
      await store.saveImmediatelyIfNeeded(currentChatId, false);
    } catch (error) {
      console.warn('Failed to save current conversation before switching:', error);
    }
  }

  // Switch to target chat if needed
  if (shouldSwitchChat) {
    try {
      const activeLeaf = plugin.app.workspace.activeLeaf;
      
      if (activeLeaf && activeLeaf.view.getViewType() === LIFE_NAVIGATOR_VIEW_TYPE) {
        const chatView = activeLeaf.view as ChatView;
        chatView.updateChatId(targetChatId);
        console.debug(`Switched to chat ${targetChatId} using updateChatId`);
      } else {
        // Fallback: use plugin's openChatWithConversation method
        await plugin.openChatWithConversation(targetChatId, 'current');
        console.debug(`Switched to chat ${targetChatId} using openChatWithConversation`);
      }
    } catch (error) {
      console.error('Failed to switch to target chat:', error);
      // Continue anyway - the message will still be added
    }
  }

  // Set title if provided and it's a new chat
  if (title && shouldSwitchChat) {
    const targetChatState = store.getChatState(targetChatId);
    if (targetChatState) {
      targetChatState.chat.storedConversation.title = title;
      targetChatState.chat.meta.updatedAt = Date.now();
    }
  }

  // Add the message to the target chat - this will trigger AI processing automatically
  try {
    await store.addUserMessage(targetChatId, message, []);
    console.debug(`Added message to chat ${targetChatId} and triggered AI processing`);
  } catch (error) {
    console.error('Failed to add message to target chat:', error);
    throw error;
  }

  return targetChatId;
}

/**
 * Helper function to get current chat ID from the active chat view
 * @returns Current chat ID or null if not available
 */
export function getCurrentChatId(): string | null {
  const plugin = LifeNavigatorPlugin.getInstance();
  if (!plugin) return null;

  const activeLeaf = plugin.app.workspace.activeLeaf;
  if (activeLeaf && activeLeaf.view.getViewType() === LIFE_NAVIGATOR_VIEW_TYPE) {
    const chatView = activeLeaf.view as ChatView;
    return chatView.getChatId();
  }

  return null;
} 