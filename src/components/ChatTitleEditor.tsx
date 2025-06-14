import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LucideIcon } from './LucideIcon';
import { t } from '../i18n';
import { usePluginStore } from '../store/plugin-store';

interface ChatTitleEditorProps {
  chatId: string;
  title: string;
  isUnread: boolean;
  forceEdit?: boolean;
  onStartEdit?: () => void;
  onFinishEdit?: () => void;
}

export const ChatTitleEditor: React.FC<ChatTitleEditorProps> = ({
  chatId,
  title,
  isUnread,
  forceEdit = false,
  onStartEdit,
  onFinishEdit
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const updateConversationTitle = usePluginStore(state => state.updateConversationTitle);

  // Reset edit value when title prop changes
  useEffect(() => {
    setEditValue(title);
  }, [title]);

  // Handle external force edit trigger
  useEffect(() => {
    if (forceEdit && !isEditing) {
      setIsEditing(true);
      setEditValue(title);
      onStartEdit?.();
    }
  }, [forceEdit, isEditing, title, onStartEdit]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditValue(title);
    onStartEdit?.();
  }, [title, onStartEdit]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(title);
    onFinishEdit?.();
  }, [title, onFinishEdit]);

  const handleSaveEdit = useCallback(async () => {
    if (editValue.trim() === title.trim()) {
      handleCancelEdit();
      return;
    }

    if (editValue.trim() === '') {
      handleCancelEdit();
      return;
    }

    setIsUpdating(true);
    try {
      // Get the conversation ID from the chat state
      const chatState = usePluginStore.getState().getChatState(chatId);
      if (chatState && chatState.chat.meta.id) {
        // For new conversations that haven't been saved yet, we need to save first
        if (!chatState.chat.meta.filePath) {
          // Save the conversation first to create the file
          const store = usePluginStore.getState();
          const savedId = await store.saveConversation(chatId);
          
          if (savedId) {
            // Now try to update the title
            const success = await updateConversationTitle(savedId, editValue.trim());
            if (success) {
              setIsEditing(false);
              onFinishEdit?.();
            }
          }
        } else {
          // File exists, update title directly
          const success = await updateConversationTitle(chatState.chat.meta.id, editValue.trim());
          if (success) {
            setIsEditing(false);
            onFinishEdit?.();
          }
        }
      }
    } catch (error) {
      console.error('Failed to update chat title:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [editValue, title, chatId, updateConversationTitle, handleCancelEdit, onFinishEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const handleInputBlur = useCallback(() => {
    // Small delay to allow for potential click events on save/cancel buttons
    setTimeout(() => {
      if (isEditing) {
        handleSaveEdit();
      }
    }, 150);
  }, [isEditing, handleSaveEdit]);

  if (isEditing) {
    return (
      <div className="ln-chat-title">
        {isUnread && (
          <div className="ln-unread-indicator" aria-label={t('ui.chat.unreadIndicator')} />
        )}
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          className="ln-chat-title-input"
          placeholder={t('ui.chat.titlePlaceholder')}
          disabled={isUpdating}
          maxLength={50}
        />
        <div className="ln-flex ln-items-center ln-flex-shrink-0">
          <button
            onClick={handleSaveEdit}
            disabled={isUpdating}
            className="clickable-icon ln-text-normal"
            style={{ color: 'var(--interactive-accent)' }}
            aria-label={t('ui.chat.saveTitle')}
          >
            {isUpdating ? (
              <LucideIcon name="loader-2" size={18} className="animate-spin" />
            ) : (
              <LucideIcon name="check" size={18} />
            )}
          </button>
          <button
            onClick={handleCancelEdit}
            disabled={isUpdating}
            className="clickable-icon ln-text-muted"
            aria-label={t('ui.chat.cancelEdit')}
          >
            <LucideIcon name="x" size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ln-chat-title">
      {isUnread && (
        <div className="ln-unread-indicator" aria-label={t('ui.chat.unreadIndicator')} />
      )}
      <button
        onClick={handleStartEdit}
        className="ln-chat-title-button"
        aria-label={t('ui.chat.editTitleInline')}
        title={t('ui.chat.editTitleInline')}
      >
        <span className="ln-chat-title-text">
          {title || t('ui.chat.untitledChat')}
        </span>
        <LucideIcon name="edit-2" size={14} className="ln-chat-title-icon" />
      </button>
    </div>
  );
}; 