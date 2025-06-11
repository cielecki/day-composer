import { t } from 'src/i18n';

/**
 * Shared function to handle conversation deletion with confirmation
 * @param conversationId - The ID of the conversation to delete
 * @param deleteConversation - The delete function from the store
 * @param onSuccess - Optional callback to execute after successful deletion
 * @returns Promise<boolean> - Whether the deletion was successful
 */
export async function handleDeleteConversation(
  conversationId: string,
  deleteConversation: (id: string) => Promise<boolean>,
  onSuccess?: () => Promise<void> | void
): Promise<boolean> {
  const confirmMessage = t('ui.chat.deleteConfirm');
  
  if (confirm(confirmMessage)) {
    try {
      const success = await deleteConversation(conversationId);
      if (success && onSuccess) {
        await onSuccess();
      }
      return success;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      return false;
    }
  }
  
  return false;
} 