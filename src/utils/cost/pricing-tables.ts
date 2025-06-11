import { AnthropicPricingTable, AnthropicModelId, isAnthropicModelId } from '../../types/anthropic-models';

/**
 * Anthropic API pricing table (as of January 2025)
 * All prices are in USD per million tokens
 * Updated with latest model releases and correct naming patterns
 * 
 * Type safety: This table is constrained to only contain models defined in ANTHROPIC_MODEL_IDS
 */
export const ANTHROPIC_PRICING: AnthropicPricingTable = {
  // Claude 4 models (correct names from official docs)
  'claude-sonnet-4-20250514': {
    input_price_per_mtok: 3.00,
    output_price_per_mtok: 15.00,
    cache_write_price_per_mtok: 3.75,
    cache_read_price_per_mtok: 0.30,
  },
  'claude-opus-4-20250514': {
    input_price_per_mtok: 15.00,
    output_price_per_mtok: 75.00,
    cache_write_price_per_mtok: 18.75,
    cache_read_price_per_mtok: 1.50,
  },
  
  // Claude 3.7 models (correct date from official docs)
  'claude-3-7-sonnet-20250219': {
    input_price_per_mtok: 3.00,
    output_price_per_mtok: 15.00,
    cache_write_price_per_mtok: 3.75,
    cache_read_price_per_mtok: 0.30,
  },
  
  // Claude 3.5 models
  'claude-3-5-sonnet-20241022': {
    input_price_per_mtok: 3.00,
    output_price_per_mtok: 15.00,
    cache_write_price_per_mtok: 3.75,
    cache_read_price_per_mtok: 0.30,
  },
  'claude-3-5-sonnet-20240620': {
    input_price_per_mtok: 3.00,
    output_price_per_mtok: 15.00,
    cache_write_price_per_mtok: 3.75,
    cache_read_price_per_mtok: 0.30,
  },
  'claude-3-5-haiku-20241022': {
    input_price_per_mtok: 0.80,
    output_price_per_mtok: 4.00,
    cache_write_price_per_mtok: 1.00,
    cache_read_price_per_mtok: 0.08,
  },
  
  // Claude 3 models (legacy)
  'claude-3-opus-20240229': {
    input_price_per_mtok: 15.00,
    output_price_per_mtok: 75.00,
    cache_write_price_per_mtok: 18.75,
    cache_read_price_per_mtok: 1.50,
  },
  'claude-3-sonnet-20240229': {
    input_price_per_mtok: 3.00,
    output_price_per_mtok: 15.00,
    cache_write_price_per_mtok: 3.75,
    cache_read_price_per_mtok: 0.30,
  },
  'claude-3-haiku-20240307': {
    input_price_per_mtok: 0.25,
    output_price_per_mtok: 1.25,
    cache_write_price_per_mtok: 0.30,
    cache_read_price_per_mtok: 0.03,
  },
};

/**
 * Get pricing for a model, with fallback to a default model if not found
 */
export function getModelPricing(modelName: string) {
  // Try exact match first - use type guard for safety
  if (isAnthropicModelId(modelName)) {
    return ANTHROPIC_PRICING[modelName];
  }
  
  // Try to match by model family - using const assertions for type safety
  if (modelName.includes('claude-opus-4')) {
    return ANTHROPIC_PRICING['claude-opus-4-20250514' as const];
  }
  if (modelName.includes('claude-sonnet-4')) {
    return ANTHROPIC_PRICING['claude-sonnet-4-20250514' as const];
  }
  if (modelName.includes('claude-3-7-sonnet')) {
    return ANTHROPIC_PRICING['claude-3-7-sonnet-20250219' as const];
  }
  if (modelName.includes('claude-3-5-sonnet')) {
    // Default to the newer version if no specific date match
    return ANTHROPIC_PRICING['claude-3-5-sonnet-20241022' as const];
  }
  if (modelName.includes('claude-3-5-haiku')) {
    return ANTHROPIC_PRICING['claude-3-5-haiku-20241022' as const];
  }
  if (modelName.includes('claude-3-opus')) {
    return ANTHROPIC_PRICING['claude-3-opus-20240229' as const];
  }
  if (modelName.includes('claude-3-sonnet')) {
    return ANTHROPIC_PRICING['claude-3-sonnet-20240229' as const];
  }
  if (modelName.includes('claude-3-haiku')) {
    return ANTHROPIC_PRICING['claude-3-haiku-20240307' as const];
  }
  
  // Default fallback to Claude 3.5 Sonnet pricing
  console.warn(`Unknown model ${modelName}, using Claude 3.5 Sonnet pricing as fallback`);
  return ANTHROPIC_PRICING['claude-3-5-sonnet-20241022' as const];
} 