import { ApiUsageData, CostEntry, ChatCostData } from '../../types/cost-tracking';
import { getModelPricing } from './pricing-tables';

/**
 * Calculate cost for a single API call
 */
export function calculateApiCallCost(
  model: string,
  usage: ApiUsageData,
  timestamp: number,
  duration?: number,
  apiCallId?: string
): CostEntry {
  const pricing = getModelPricing(model);
  
  // Calculate costs for different token types
  const input_cost = (usage.input_tokens / 1_000_000) * pricing.input_price_per_mtok;
  const output_cost = (usage.output_tokens / 1_000_000) * pricing.output_price_per_mtok;
  
  // Calculate cache costs
  const cache_write_tokens = usage.cache_creation_input_tokens || 0;
  const cache_read_tokens = usage.cache_read_input_tokens || 0;
  
  const cache_write_cost = (cache_write_tokens / 1_000_000) * pricing.cache_write_price_per_mtok;
  const cache_read_cost = (cache_read_tokens / 1_000_000) * pricing.cache_read_price_per_mtok;
  
  const total_cost = input_cost + output_cost + cache_write_cost + cache_read_cost;
  
  return {
    id: apiCallId || `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    duration,
    model,
    usage,
    cost: total_cost,
    breakdown: {
      input_cost,
      output_cost,
      cache_write_cost,
      cache_read_cost,
    },
  };
}

/**
 * Calculate total cost data for a chat from its cost entries
 */
export function calculateChatCostData(entries: CostEntry[]): ChatCostData {
  const totals = entries.reduce(
    (acc, entry) => ({
      total_cost: acc.total_cost + entry.cost,
      total_input_tokens: acc.total_input_tokens + entry.usage.input_tokens,
      total_output_tokens: acc.total_output_tokens + entry.usage.output_tokens,
      total_cache_write_tokens: acc.total_cache_write_tokens + (entry.usage.cache_creation_input_tokens || 0),
      total_cache_read_tokens: acc.total_cache_read_tokens + (entry.usage.cache_read_input_tokens || 0),
    }),
    {
      total_cost: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cache_write_tokens: 0,
      total_cache_read_tokens: 0,
    }
  );

  return {
    ...totals,
    entries,
  };
}

/**
 * Format cost as a currency string
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Format large numbers with appropriate units (K, M, B)
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(duration?: number): string {
  if (!duration) return 'N/A';
  
  if (duration < 1000) {
    return `${duration}ms`;
  }
  
  const seconds = Math.floor(duration / 1000);
  const remainingMs = duration % 1000;
  
  if (seconds < 60) {
    return remainingMs > 0 ? `${seconds}.${Math.floor(remainingMs / 100)}s` : `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
} 