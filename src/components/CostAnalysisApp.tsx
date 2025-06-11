import React, { useEffect, useState } from 'react';
import { usePluginStore } from '../store/plugin-store';
import { ChatCostData, CostEntry } from '../types/cost-tracking';
import { formatCost, formatTokenCount, formatDuration, calculateChatCostData } from '../utils/cost/cost-calculator';
import { LucideIcon } from './LucideIcon';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { getAnthropicModelDisplayName } from '../types/anthropic-models';
import { t } from '../i18n';

interface CostAnalysisAppProps {
    conversationId: string;
    onTitleChange?: (title: string) => void;
}

export const CostAnalysisApp: React.FC<CostAnalysisAppProps> = ({
    conversationId,
    onTitleChange
}) => {
    const [conversationData, setConversationData] = useState<{
        id: string;
        title: string;
        costData?: ChatCostData;
        filePath: string;
        updatedAt: number;
    } | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshIteration, setRefreshIteration] = useState(0);

    // Get store functions for file operations
    const listConversations = usePluginStore(state => state.listConversations);
    const loadConversationData = usePluginStore(state => state.loadConversationData);

    // Use the specified conversation ID
    const targetConversationId = conversationId;

    // Load conversation data
    useEffect(() => {
        const loadConversation = async () => {
            if (isRefreshing || isLoading) return;

            try {
                setIsLoading(true);
                setError(null);
                setIsRefreshing(true);
                setTimeout(() => {
                    setIsRefreshing(false);
                }, 1000);

                console.debug('Loading conversation data', targetConversationId);

                // Load stored conversation from file
                const storedConversation = await loadConversationData(targetConversationId);
                const conversations = await listConversations();
                const conversationMeta = conversations.find(c => c.id === targetConversationId);

                if (!conversationMeta) {
                    setError(`Conversation with ID "${targetConversationId}" not found`);
                    return;
                }

                setConversationData({
                    id: targetConversationId,
                    title: conversationMeta.title || t('costAnalysis.untitledConversation'),
                    costData: storedConversation?.costData,
                    filePath: conversationMeta.filePath,
                    updatedAt: conversationMeta.updatedAt
                });

                if (onTitleChange) {
                    onTitleChange(conversationMeta.title || t('costAnalysis.untitledConversation'));
                }
            } catch (error) {
                console.error('Failed to load conversation data:', error);
                setError(`Failed to load conversation: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setIsLoading(false);
            }
        };

        loadConversation();
    }, [targetConversationId, refreshIteration, loadConversationData, listConversations, onTitleChange]);

    const handleRefresh = async () => {
        setRefreshIteration(refreshIteration + 1);
    };

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };



    const hasNoCostData = error || !conversationData?.costData || conversationData.costData.entries.length === 0;

    return (
        <div className="cost-analysis-container">
            <div className="cost-analysis-header">
                <h1 className="cost-analysis-title">
                    <LucideIcon name="dollar-sign" size={24} />
                    {t('costAnalysis.titleWithName', { title: conversationData?.title || t('costAnalysis.untitledConversation') })}
                </h1>
                <button
                    className="cost-analysis-refresh-btn"
                    onClick={handleRefresh}
                    disabled={isRefreshing || isLoading}
                    title={t('costAnalysis.refreshTooltip')}
                >
                    <LucideIcon name={isRefreshing ? "loader-2" : "refresh-cw"} size={16} />
                </button>
            </div>


            {isLoading && <div className="cost-analysis-loading">
                <LucideIcon name="loader-2" size={24} className="animate-spin" />
                <p>{t('costAnalysis.loading')}</p>
            </div>}

            {!isLoading && <div className="cost-analysis-content">
                {hasNoCostData ? (
                    <div className="cost-empty-state">
                        <LucideIcon name="info" size={48} />
                        <h3>{t('costAnalysis.emptyState.title')}</h3>
                        <p>{t('costAnalysis.emptyState.description')}</p>
                    </div>
                ) : (
                    <>
                        {/* Conversation Summary */}
                        <div className="conversation-summary-section">
                            <h2>{t('costAnalysis.summary.title')}</h2>
                            <div className="conversation-summary-grid">
                                <div className="conversation-summary-item">
                                    <span className="conversation-summary-label">{t('costAnalysis.summary.totalCost')}</span>
                                    <span className="conversation-summary-value total-cost">
                                        {formatCost(conversationData.costData!.total_cost)}
                                    </span>
                                </div>
                                <div className="conversation-summary-item">
                                    <span className="conversation-summary-label">{t('costAnalysis.summary.inputTokens')}</span>
                                    <span className="conversation-summary-value">
                                        {formatTokenCount(conversationData.costData!.total_input_tokens)}
                                    </span>
                                </div>
                                <div className="conversation-summary-item">
                                    <span className="conversation-summary-label">{t('costAnalysis.summary.outputTokens')}</span>
                                    <span className="conversation-summary-value">
                                        {formatTokenCount(conversationData.costData!.total_output_tokens)}
                                    </span>
                                </div>
                                <div className="conversation-summary-item">
                                    <span className="conversation-summary-label">{t('costAnalysis.summary.cacheWrites')}</span>
                                    <span className="conversation-summary-value">
                                        {formatTokenCount(conversationData.costData!.total_cache_write_tokens)}
                                    </span>
                                </div>
                                <div className="conversation-summary-item">
                                    <span className="conversation-summary-label">{t('costAnalysis.summary.cacheReads')}</span>
                                    <span className="conversation-summary-value">
                                        {formatTokenCount(conversationData.costData!.total_cache_read_tokens)}
                                    </span>
                                </div>
                                <div className="conversation-summary-item">
                                    <span className="conversation-summary-label">{t('costAnalysis.summary.apiCalls')}</span>
                                    <span className="conversation-summary-value">
                                        {conversationData.costData!.entries.length}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Detailed API Call History */}
                        <div className="api-calls-section">
                            <h2>{t('costAnalysis.history.title')}</h2>
                            <div className="api-calls-list">
                                {[...conversationData.costData!.entries]
                                    .sort((a, b) => b.timestamp - a.timestamp)
                                    .map((entry) => (
                                        <div key={entry.id} className="api-call-entry">
                                            <div className="api-call-header">
                                                <div className="api-call-info">
                                                    <span className="api-call-model">
                                                        {getAnthropicModelDisplayName(entry.model)}
                                                    </span>
                                                    <span className="api-call-time">
                                                        {formatTimestamp(entry.timestamp)}
                                                    </span>
                                                    {entry.duration && (
                                                        <span className="api-call-duration">
                                                            {formatDuration(entry.duration)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="api-call-total">
                                                    {formatCost(entry.cost)}
                                                </div>
                                            </div>

                                            <div className="api-call-details">
                                                <div className="api-call-tokens">
                                                    <div className="api-call-token-item">
                                                        <span className="api-call-token-label">{t('costAnalysis.history.input')}</span>
                                                        <span className="api-call-token-value">
                                                            {formatTokenCount(entry.usage.input_tokens)}
                                                            ({formatCost(entry.breakdown.input_cost)})
                                                        </span>
                                                    </div>
                                                    <div className="api-call-token-item">
                                                        <span className="api-call-token-label">{t('costAnalysis.history.output')}</span>
                                                        <span className="api-call-token-value">
                                                            {formatTokenCount(entry.usage.output_tokens)}
                                                            ({formatCost(entry.breakdown.output_cost)})
                                                        </span>
                                                    </div>
                                                    {(entry.usage.cache_creation_input_tokens || 0) > 0 && (
                                                        <div className="api-call-token-item">
                                                            <span className="api-call-token-label">{t('costAnalysis.history.cacheWrite')}</span>
                                                            <span className="api-call-token-value">
                                                                {formatTokenCount(entry.usage.cache_creation_input_tokens || 0)}
                                                                ({formatCost(entry.breakdown.cache_write_cost)})
                                                            </span>
                                                        </div>
                                                    )}
                                                    {(entry.usage.cache_read_input_tokens || 0) > 0 && (
                                                        <div className="api-call-token-item">
                                                            <span className="api-call-token-label">{t('costAnalysis.history.cacheRead')}</span>
                                                            <span className="api-call-token-value">
                                                                {formatTokenCount(entry.usage.cache_read_input_tokens || 0)}
                                                                ({formatCost(entry.breakdown.cache_read_cost)})
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </>
                )}
            </div>}
        </div>
    );
}; 