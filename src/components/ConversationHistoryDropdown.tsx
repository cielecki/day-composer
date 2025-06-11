import React, { useState, useRef, useEffect } from 'react';
import { ConversationMeta } from 'src/utils/chat/conversation';
import { LucideIcon } from './LucideIcon';
import { usePluginStore } from '../store/plugin-store';
import { t } from 'src/i18n';
import { handleDeleteConversation } from 'src/utils/chat/delete-conversation-handler';

interface ConversationHistoryDropdownProps {
    onConversationSelect: (conversationId: string) => void;
    isOpen: boolean;
    onToggle: () => void;
    currentConversationId?: string | null;
}

export const ConversationHistoryDropdown: React.FC<ConversationHistoryDropdownProps> = ({
    onConversationSelect,
    isOpen,
    onToggle,
    currentConversationId
}) => {
    const [conversations, setConversations] = useState<ConversationMeta[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Use store methods instead of database prop
    const listConversations = usePluginStore(state => state.listConversations);
    const deleteConversation = usePluginStore(state => state.deleteConversation);
    const updateConversationTitle = usePluginStore(state => state.updateConversationTitle);

    // Load conversations when dropdown opens
    useEffect(() => {
        if (isOpen) {
            loadConversations();
            // Focus search input when dropdown opens
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);


    const loadConversations = async () => {
        setLoading(true);
        try {
            // listConversations now returns conversations already sorted by recency (file modification time)
            const allConversations = await listConversations();
            setConversations(allConversations);
        } catch (error) {
            console.error('Failed to load conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredConversations = conversations.filter(conv => {
        const query = searchQuery.toLowerCase();
        return (
            conv.title.toLowerCase().includes(query)
        );
    });

    const handleConversationClick = (conversationId: string) => {
        onConversationSelect(conversationId);
        onToggle();
    };

    const handleDeleteConversationClick = async (e: React.MouseEvent, conversationId: string) => {
        e.stopPropagation();
        await handleDeleteConversation(conversationId, deleteConversation, loadConversations);
    };

    const handleStartEdit = (e: React.MouseEvent, conversation: ConversationMeta) => {
        e.stopPropagation();
        setEditingId(conversation.id);
        setEditTitle(conversation.title);
    };

    const handleSaveEdit = async (e: React.KeyboardEvent, conversationId: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            try {
                await updateConversationTitle(conversationId, editTitle);
                setEditingId(null);
                setEditTitle('');
                await loadConversations();
            } catch (error) {
                console.error('Failed to update conversation title:', error);
            }
        } else if (e.key === 'Escape') {
            setEditingId(null);
            setEditTitle('');
        }
    };

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
                {loading ? (
                    <div className="loading-state">
                        {t('ui.chat.historyLoading')}
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="history-empty-state">
                        {searchQuery ? t('ui.chat.historyNoResults') : t('ui.chat.historyEmpty')}
                    </div>
                ) : (
                    filteredConversations.map((conversation) => (
                        <div
                            key={conversation.id}
                            className={`conversation-item ${
                                currentConversationId === conversation.id ? 'current' : ''
                            }`}
                            onClick={() => handleConversationClick(conversation.id)}
                        >
                            <div className="conversation-content">
                                <div className="conversation-main">
                                    {editingId === conversation.id ? (
                                        <input
                                            type="text"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onKeyDown={(e) => handleSaveEdit(e, conversation.id)}
                                            onBlur={() => setEditingId(null)}
                                            className="edit-input"
                                            autoFocus
                                        />
                                    ) : (
                                        <div className="conversation-title">
                                            {conversation.title}
                                        </div>
                                    )}
                                    
                                    <div className="conversation-meta">
                                        <span>
                                            {formatRelativeTime(conversation.updatedAt)}
                                        </span>
                                    </div>
                                </div>

                                <div className="conversation-actions">
                                    <button
                                        onClick={(e) => handleStartEdit(e, conversation)}
                                        className="clickable-icon"
                                        title="Edit title"
                                    >
                                        <LucideIcon name="pencil" size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteConversationClick(e, conversation.id)}
                                        className="clickable-icon"
                                        title="Delete conversation"
                                    >
                                        <LucideIcon name="trash-2" size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}; 