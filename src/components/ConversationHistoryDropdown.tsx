import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Chat, isMetadataLoaded, isFullyLoaded } from 'src/utils/chat/conversation';
import { LucideIcon } from './LucideIcon';
import { UnreadIndicator } from './UnreadIndicator';
import { UnifiedDropdown } from './UnifiedDropdown';
import { useSearch } from '../hooks/useSearch';
import { usePluginStore } from '../store/plugin-store';
import { t } from 'src/i18n';
import { handleDeleteConversation } from 'src/utils/chat/delete-conversation-handler';
import { formatRelativeTime } from '../utils/time/format-relative-time';

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
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

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
            // Focus search input when dropdown opens is now handled by UnifiedDropdown
        }
    }, [isOpen, isLoaded, refreshConversationList]);

    // Use unified search hook with debouncing for metadata loading
    const search = useSearch(
        conversationItems,
        (item: Chat) => {
            // For skeleton items (without loaded metadata), return a placeholder that won't match searches
            // This ensures skeletons are included in the base list but excluded from search results
            if (!isMetadataLoaded(item) || !item.storedConversation?.title) {
                return ['__SKELETON_ITEM__']; // Special marker that won't match user searches
            }
            return [item.storedConversation.title];
        },
        { 
            debounceMs: 300,
            minQueryLength: 0  // Show all items when no search query
        }
    );

    // Trigger metadata loading when search query changes (debounced)
    useEffect(() => {
        if (!search.hasQuery || !isLoaded) return;
        loadAllConversationMetadata();
    }, [search.hasQuery, isLoaded, loadAllConversationMetadata]);

    const handleLoadMetadata = useCallback(async (conversationId: string) => {
        console.debug('ConversationHistoryDropdown: Loading metadata for', conversationId);
        try {
            const result = await loadConversationMetadata(conversationId);
            console.debug('ConversationHistoryDropdown: Metadata loaded for', conversationId, 'result:', result);
            
            // Check what the conversation looks like after loading
            const updatedConversation = getConversationById(conversationId);
            console.debug('ConversationHistoryDropdown: Updated conversation:', {
                id: conversationId,
                hasStoredConversation: !!updatedConversation?.storedConversation,
                title: updatedConversation?.storedConversation?.title,
                isMetadataLoaded: updatedConversation ? isMetadataLoaded(updatedConversation) : false
            });
        } catch (error) {
            console.error('ConversationHistoryDropdown: Failed to load metadata for', conversationId, error);
        }
        // No need to call markConversationMetadataLoaded anymore - loadConversationMetadata does it
    }, [loadConversationMetadata, getConversationById]);

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
        await handleDeleteConversation(conversationId, deleteConversation);
    };

    // Filter conversations based on search state
    // When not searching: show all conversations (including skeletons)
    // When searching: only show conversations with loaded metadata that match the search
    const filteredConversations = search.hasQuery 
        ? search.filteredItems.filter((item: Chat) => {
            // When searching, exclude skeleton items since they can't match searches anyway
            return isMetadataLoaded(item) && item.storedConversation?.title;
          })
        : conversationItems; // When not searching, show ALL conversations (including skeletons)

    // Debug logging
    console.debug('ConversationHistoryDropdown debug:', {
        isOpen,
        isLoaded,
        conversationItemsCount: conversationItems.length,
        filteredConversationsCount: filteredConversations.length,
        hasQuery: search.hasQuery,
        sampleItems: conversationItems.slice(0, 3).map(item => ({
            id: item.meta.id,
            hasStoredConversation: !!item.storedConversation,
            title: item.storedConversation?.title,
            isMetadataLoaded: isMetadataLoaded(item)
        }))
    });

    return (
        <UnifiedDropdown
            isOpen={isOpen}
            onClose={onToggle}
            trigger={<></>}
            position="bottom-right"
            searchable={true}
            searchPlaceholder={t('ui.chat.historySearchPlaceholder')}
            onSearch={search.handleSearch}
            emptyText={search.hasQuery ? t('ui.chat.historyNoResults') : t('ui.chat.historyEmpty')}
            maxHeight={400}
            minWidth={300}
            maxWidth={350}
        >
            {/* Custom content for conversations list */}
            <div className="conversations-list">
                {!isLoaded ? (
                    <div className="loading-state">
                        {t('ui.chat.historyLoading')}
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="history-empty-state">
                        {search.hasQuery ? t('ui.chat.historyNoResults') : t('ui.chat.historyEmpty')}
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
        </UnifiedDropdown>
    );
}; 