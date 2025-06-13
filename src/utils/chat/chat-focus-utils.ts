import { LifeNavigatorPlugin } from '../../LifeNavigatorPlugin';
import { LIFE_NAVIGATOR_VIEW_TYPE, ChatView } from '../../views/chat-view';

/**
 * Dynamically checks if a chat is currently focused by examining Obsidian's workspace state
 * @param chatId The ID of the chat to check
 * @returns true if the chat is currently focused/active, false otherwise
 */
export function isChatCurrentlyFocused(chatId: string): boolean {
  const plugin = LifeNavigatorPlugin.getInstance();
  if (!plugin) {
    return false;
  }

  const activeLeaf = plugin.app.workspace.activeLeaf;
  
  // Check if the active leaf is a chat view
  if (!activeLeaf || activeLeaf.view.getViewType() !== LIFE_NAVIGATOR_VIEW_TYPE) {
    return false;
  }

  // Get the chat ID from the active chat view
  const chatView = activeLeaf.view as ChatView;
  const activeChatId = chatView.getChatId();
  
  return activeChatId === chatId;
}

/**
 * Gets the currently focused chat ID, if any
 * @returns The chat ID of the currently focused chat, or null if no chat is focused
 */
export function getCurrentlyFocusedChatId(): string | null {
  const plugin = LifeNavigatorPlugin.getInstance();
  if (!plugin) {
    return null;
  }

  const activeLeaf = plugin.app.workspace.activeLeaf;
  
  // Check if the active leaf is a chat view
  if (!activeLeaf || activeLeaf.view.getViewType() !== LIFE_NAVIGATOR_VIEW_TYPE) {
    return null;
  }

  // Get the chat ID from the active chat view
  const chatView = activeLeaf.view as ChatView;
  return chatView.getChatId();
} 