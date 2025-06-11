/**
 * Shared Anthropic model definitions
 * This file ensures type safety between model selection and pricing
 */

// Core model IDs that actually exist in the Anthropic API
export const ANTHROPIC_MODEL_IDS = [
  "claude-opus-4-20250514",        // Claude Opus 4 - Most capable
  "claude-sonnet-4-20250514",      // Claude Sonnet 4 - High performance
  "claude-3-5-haiku-20241022",     // Claude Haiku 3.5 - Fastest
  "claude-3-7-sonnet-20250219",    // Claude Sonnet 3.7 - Hybrid reasoning
  "claude-3-5-sonnet-20241022",    // Claude Sonnet 3.5 v2
  "claude-3-5-sonnet-20240620",    // Claude Sonnet 3.5 v1
  "claude-3-opus-20240229",        // Claude Opus 3 (legacy)
  "claude-3-sonnet-20240229",      // Claude Sonnet 3 (legacy)
  "claude-3-haiku-20240307",       // Claude Haiku 3 (legacy)
] as const;

// Type for actual model IDs
export type AnthropicModelId = typeof ANTHROPIC_MODEL_IDS[number];

// Models available for selection (includes "auto" option)
export const ANTHROPIC_MODELS = [
  "auto",                          // Auto-select based on mode characteristics
  ...ANTHROPIC_MODEL_IDS,
] as const;

// Type for selectable models (includes "auto")
export type AnthropicModel = typeof ANTHROPIC_MODELS[number];

// Type constraint to ensure pricing table only contains valid model IDs
export type AnthropicPricingTable = {
  [K in AnthropicModelId]: {
    input_price_per_mtok: number;
    output_price_per_mtok: number;
    cache_write_price_per_mtok: number;
    cache_read_price_per_mtok: number;
  };
};

// Helper function to check if a string is a valid model ID
export function isAnthropicModelId(model: string): model is AnthropicModelId {
  return ANTHROPIC_MODEL_IDS.includes(model as AnthropicModelId);
}

// Helper function to check if a string is a valid selectable model
export function isAnthropicModel(model: string): model is AnthropicModel {
  return ANTHROPIC_MODELS.includes(model as AnthropicModel);
}

// Helper function to get user-friendly display names for models
export function getAnthropicModelDisplayName(model: string): string {
  if (model.includes('claude-opus-4')) return 'Claude Opus 4';
  if (model.includes('claude-sonnet-4')) return 'Claude Sonnet 4';
  if (model.includes('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet';
  if (model.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet';
  if (model.includes('claude-3-5-haiku')) return 'Claude 3.5 Haiku';
  if (model.includes('claude-3-opus')) return 'Claude 3 Opus';
  if (model.includes('claude-3-sonnet')) return 'Claude 3 Sonnet';
  if (model.includes('claude-3-haiku')) return 'Claude 3 Haiku';
  return model;
} 