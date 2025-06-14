import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Chat, isMetadataLoaded, isFullyLoaded } from 'src/utils/chat/conversation';
import { LucideIcon } from './LucideIcon';
import { UnreadIndicator } from './UnreadIndicator';
import { usePluginStore } from '../store/plugin-store';
import { t } from 'src/i18n';
import { handleDeleteConversation } from 'src/utils/chat/delete-conversation-handler';

interface VirtualConversationHistoryDropdownProps {
    onConversationSelect: (conversationId: string) => void;
    isOpen: boolean;
    onToggle: () => void;
    currentConversationId?: string | null;
}

interface ConversationItemProps {
    item: Chat;
    isCurrentConversation: boolean;
    onConversationClick: (id: string) => void;
    onLoadMetadata: (id: string) => void;
    onLoadFullChat: (id: string) => void;
    onStartEdit: (item: Chat) => void;
    onDelete: (id: string) => void;
    editingId: string | null;
    editTitle: string;
    onEditTitleChange: (title: string) => void;
    onSaveEdit: (e: React.KeyboardEvent, id: string) => void;
    onCancelEdit: () => void;
}

const ConversationSkeleton: React.FC<{ updatedAt: number }> = ({ updatedAt }) => {
    const formatRelativeTime = (timestamp: number) => {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now.getTime() - past.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return past.toLocaleDateString();
    };

    return (
        <div className="conversation-content">
            <div className="conversation-main">
                <div className="conversation-title">
                    <div className="skeleton-line" style={{ 
                        width: '70%', 
                        height: '14px', 
                        backgroundColor: 'var(--background-modifier-border)', 
                        borderRadius: '2px',
                        animation: 'pulse 1.5s ease-in-out infinite'
                    }} />
                </div>
                <div className="conversation-meta">
                    <span>{formatRelativeTime(updatedAt)}</span>
                </div>
            </div>
            
            <div className="conversation-actions">
                <div className="skeleton-line" style={{ 
                    width: '18px', 
                    height: '18px', 
                    backgroundColor: 'var(--background-modifier-border)', 
                    borderRadius: '2px',
                    animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <div className="skeleton-line" style={{ 
                    width: '18px', 
                    height: '18px', 
                    backgroundColor: 'var(--background-modifier-border)', 
                    borderRadius: '2px',
                    animation: 'pulse 1.5s ease-in-out infinite'
                }} />
            </div>
        </div>
    );
};

const ConversationItem: React.FC<ConversationItemProps> = ({
    item,
    isCurrentConversation,
    onConversationClick,
    onLoadMetadata,
    onLoadFullChat,
    onStartEdit,
    onDelete,
    editingId,
    editTitle,
    onEditTitleChange,
    onSaveEdit,
    onCancelEdit
}) => {
    const itemRef = useRef<HTMLDivElement>(null);
    
    // Properly subscribe to chat state changes
    const chatState = usePluginStore(
        useCallback((state) => state.getChatState(item.meta.id), [item.meta.id])
    );
    const isGenerating = chatState?.isGenerating || false;

    const formatRelativeTime = (timestamp: number) => {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now.getTime() - past.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return past.toLocaleDateString();
    };

    // Intersection Observer for lazy loading
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    // Load metadata when scrolled into view
                    if (!isMetadataLoaded(item)) {
                        onLoadMetadata(item.meta.id);
                    }
                    
                    // Preload full chat when more visible (for instant switching)
                    if (!isFullyLoaded(item) && entry.intersectionRatio > 0.3) {
                        onLoadFullChat(item.meta.id);
                    }
                }
            },
            { 
                rootMargin: '50px', // Start loading 50px before visible
                threshold: [0.1, 0.3, 0.5]
            }
        );

        if (itemRef.current) {
            observer.observe(itemRef.current);
        }

        return () => observer.disconnect();
    }, [item.meta.id, isMetadataLoaded(item), isFullyLoaded(item), onLoadMetadata, onLoadFullChat]);

    return (
        <div
            ref={itemRef}
            className={`conversation-item ${isCurrentConversation ? 'current' : ''} ${isGenerating ? 'generating' : ''}`}
            onClick={() => onConversationClick(item.meta.id)}
            data-conversation-id={item.meta.id}
        >
            {isMetadataLoaded(item) ? (
                <div className="conversation-content">
                    <div className="conversation-main">
                        {editingId === item.meta.id ? (
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => onEditTitleChange(e.target.value)}
                                onKeyDown={(e) => onSaveEdit(e, item.meta.id)}
                                onBlur={onCancelEdit}
                                className="edit-input"
                                autoFocus
                            />
                        ) : (
                            <div className="conversation-title">
                                <UnreadIndicator isUnread={chatState?.chat.storedConversation?.isUnread ?? item.storedConversation?.isUnread ?? false} />
                                <span className="conversation-title-text">
                                    {chatState?.chat.storedConversation?.title ?? item.storedConversation?.title ?? 'Loading...'}
                                </span>
                            </div>
                        )}
                        
                        <div className="conversation-meta">
                            <span>{formatRelativeTime(chatState?.chat.meta.updatedAt ?? item.meta.updatedAt)}</span>
                        </div>
                    </div>

                    <div className="conversation-actions">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onStartEdit(item);
                            }}
                            className="clickable-icon"
                            title="Edit title"
                        >
                            <LucideIcon name="pencil" size={18} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.meta.id);
                            }}
                            className="clickable-icon"
                            title="Delete conversation"
                        >
                            <LucideIcon name="trash-2" size={18} />
                        </button>
                    </div>
                </div>
            ) : (
                <ConversationSkeleton updatedAt={item.meta.updatedAt} />
            )}
        </div>
    );
};

export const ConversationHistoryDropdown: React.FC<VirtualConversationHistoryDropdownProps> = ({
    onConversationSelect,
    isOpen,
    onToggle,
    currentConversationId
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Subscribe to global conversation list
    const conversationList = usePluginStore(state => state.conversationList);
    const conversations = usePluginStore(state => state.conversations);
    const conversationItems = Array.from(conversations.values());
    const isLoaded = conversationList.isLoaded;

    // Store methods
    const refreshConversationList = usePluginStore(state => state.refreshConversationList);
    const loadConversationMetadata = usePluginStore(state => state.loadConversationMetadata);
    const markConversationMetadataLoaded = usePluginStore(state => state.markConversationMetadataLoaded);
    const loadChat = usePluginStore(state => state.loadChat);
    const markConversationFullyLoaded = usePluginStore(state => state.markConversationFullyLoaded);
    const getChatState = usePluginStore(state => state.getChatState);
    const deleteConversation = usePluginStore(state => state.deleteConversation);
    const updateConversationTitle = usePluginStore(state => state.updateConversationTitle);
    const getConversationById = usePluginStore(state => state.getConversationById);

    // Track if we've already loaded all metadata to avoid repeated calls
    const [hasLoadedAllMetadata, setHasLoadedAllMetadata] = useState(false);

    // Load all conversation metadata for comprehensive search
    const loadAllConversationMetadata = useCallback(async () => {
        if (hasLoadedAllMetadata) return; // Skip if already loaded
        
        const allConversations = Array.from(conversations.values());
        const unloadedConversations = allConversations.filter((chat: Chat) => !isMetadataLoaded(chat));
        
        if (unloadedConversations.length === 0) {
            setHasLoadedAllMetadata(true);
            return;
        }
        
        // Load metadata for all unloaded conversations in parallel
        const loadPromises = unloadedConversations.map((chat: Chat) => 
            loadConversationMetadata(chat.meta.id)
        );
        
        await Promise.all(loadPromises);
        setHasLoadedAllMetadata(true);
        console.debug('loadAllConversationMetadata - completed');
    }, [conversations, loadConversationMetadata, hasLoadedAllMetadata]);

    // Load conversation list when dropdown opens (only if not already loaded)
    useEffect(() => {
        if (isOpen) {
            if (!isLoaded) {
                refreshConversationList();
                setHasLoadedAllMetadata(false); // Reset when refreshing list
            }
            // Focus search input when dropdown opens
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen, isLoaded, refreshConversationList]);

    // Debounced search effect - only trigger metadata loading after user stops typing
    useEffect(() => {
        if (!searchQuery.trim() || !isLoaded) return;
        
        const timeoutId = setTimeout(() => {
            loadAllConversationMetadata();
        }, 300); // 300ms debounce
        
        return () => clearTimeout(timeoutId);
    }, [searchQuery, isLoaded, loadAllConversationMetadata]);

    const handleLoadMetadata = useCallback(async (conversationId: string) => {
        await loadConversationMetadata(conversationId);
        // No need to call markConversationMetadataLoaded anymore - loadConversationMetadata does it
    }, [loadConversationMetadata]);

    const handleLoadFullChat = useCallback(async (conversationId: string) => {
        // Skip if already loaded
        const chatState = getChatState(conversationId);
        if (chatState) {
            markConversationFullyLoaded(conversationId);
            return;
        }

        // Load full chat into memory for instant switching
        const success = await loadChat(conversationId);
        if (success) {
            markConversationFullyLoaded(conversationId);
        }
    }, [loadChat, getChatState, markConversationFullyLoaded]);

    const handleConversationClick = (conversationId: string) => {
        onConversationSelect(conversationId);
        onToggle();
    };

    const handleStartEdit = (item: Chat) => {
        setEditingId(item.meta.id);
        setEditTitle(item.storedConversation?.title || '');
    };

    const handleSaveEdit = async (e: React.KeyboardEvent, conversationId: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            try {
                await updateConversationTitle(conversationId, editTitle);
                setEditingId(null);
                setEditTitle('');
                // Title will be updated automatically via the store
            } catch (error) {
                console.error('Failed to update conversation title:', error);
            }
        } else if (e.key === 'Escape') {
            setEditingId(null);
            setEditTitle('');
        }
    };

    const handleDelete = async (conversationId: string) => {
        await handleDeleteConversation(conversationId, deleteConversation, refreshConversationList);
    };

    // Filter conversations based on search query
    const filteredConversations = useMemo(() => {
        if (!searchQuery) return conversationItems;
        
        const query = searchQuery.toLowerCase();
        return conversationItems.filter(item => {
            // Only include conversations that have metadata loaded
            if (!isMetadataLoaded(item) || !item.storedConversation?.title) {
                return false; // Exclude conversations without loaded titles
            }
            
            // Search by title
            return item.storedConversation.title.toLowerCase().includes(query);
        });
    }, [conversationItems, searchQuery]);

    if (!isOpen) return null;

    return (
        <div 
            ref={dropdownRef}
            className="conversation-history-dropdown"
        >
            {/* Search Header */}
            <div className="search-header">
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={t('ui.chat.historySearchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
            </div>

            {/* Conversations List */}
            <div className="conversations-list">
                {!isLoaded ? (
                    <div className="loading-state">
                        {t('ui.chat.historyLoading')}
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="history-empty-state">
                        {searchQuery ? t('ui.chat.historyNoResults') : t('ui.chat.historyEmpty')}
                    </div>
                ) : (
                    filteredConversations.map((item) => (
                        <ConversationItem
                            key={item.meta.id}
                            item={item}
                            isCurrentConversation={currentConversationId === item.meta.id}
                            onConversationClick={handleConversationClick}
                            onLoadMetadata={handleLoadMetadata}
                            onLoadFullChat={handleLoadFullChat}
                            onStartEdit={handleStartEdit}
                            onDelete={handleDelete}
                            editingId={editingId}
                            editTitle={editTitle}
                            onEditTitleChange={setEditTitle}
                            onSaveEdit={handleSaveEdit}
                            onCancelEdit={() => setEditingId(null)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}; 