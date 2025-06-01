import React, { useState, useRef, useEffect } from 'react';
import { ConversationDatabase } from '../services/conversation-database';
import { ConversationMeta } from '../utils/chat/conversation';
import { LucideIcon } from './LucideIcon';

interface ConversationHistoryDropdownProps {
    database: ConversationDatabase;
    onConversationSelect: (conversationId: string) => void;
    isOpen: boolean;
    onToggle: () => void;
    currentConversationId?: string | null;
}

export const ConversationHistoryDropdown: React.FC<ConversationHistoryDropdownProps> = ({
    database,
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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onToggle();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onToggle]);

    const loadConversations = async () => {
        setLoading(true);
        try {
            // listConversations now returns conversations already sorted by recency (file modification time)
            const allConversations = await database.listConversations();
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

    const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this conversation?')) {
            try {
                await database.deleteConversation(conversationId);
                await loadConversations();
            } catch (error) {
                console.error('Failed to delete conversation:', error);
            }
        }
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
                await database.updateConversationTitle(conversationId, editTitle);
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
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
            </div>

            {/* Conversations List */}
            <div className="conversations-list">
                {loading ? (
                    <div className="loading-state">
                        Loading conversations...
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="empty-state">
                        {searchQuery ? 'No conversations found' : 'No conversations yet'}
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
                                        onClick={(e) => handleDeleteConversation(e, conversation.id)}
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