import { usePluginStore } from '../../store/plugin-store';
import { DEFAULT_MODE_ID } from './ln-mode-defaults';

export interface ModeValidationResult {
  isValid: boolean;
  reason?: string;
  currentModeId?: string;
}

/**
 * Validates that modes are loaded and the current chat's mode exists
 * @param chatId - The chat ID to validate the mode for
 * @returns ModeValidationResult with validation status and reason if invalid
 */
export const validateChatMode = (chatId: string): ModeValidationResult => {
  const store = usePluginStore.getState();
  
  // Check if modes are still loading
  if (store.modes.isLoading) {
    return {
      isValid: false,
      reason: "modes are still loading"
    };
  }

  // Check if current mode exists
  const chatState = store.getChatState(chatId);
  const currentModeId = chatState?.chat.storedConversation.modeId || DEFAULT_MODE_ID;
  const currentMode = store.modes.available[currentModeId];
  
  if (!currentMode) {
    return {
      isValid: false,
      reason: `current mode '${currentModeId}' is not available`,
      currentModeId
    };
  }

  return {
    isValid: true,
    currentModeId
  };
};

/**
 * Validates chat mode and logs debug message if invalid
 * @param chatId - The chat ID to validate 
 * @param action - The action being attempted (for logging)
 * @returns true if valid, false if invalid
 */
export const validateChatModeWithLogging = (chatId: string, action: string): boolean => {
  const result = validateChatMode(chatId);
  
  if (!result.isValid) {
    console.debug(`Cannot ${action}: ${result.reason}`);
    return false;
  }
  
  return true;
}; 