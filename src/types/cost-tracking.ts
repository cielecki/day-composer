export interface ApiUsageData {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
  service_tier?: "standard" | "priority" | "batch" | null;
}

export interface CostEntry {
  id: string;
  timestamp: number;
  duration?: number; // Duration of API call in milliseconds
  model: string;
  usage: ApiUsageData;
  cost: number; // Total cost in USD
  breakdown: {
    input_cost: number;
    output_cost: number;
    cache_write_cost: number;
    cache_read_cost: number;
  };
}

export interface ChatCostData {
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_write_tokens: number;
  total_cache_read_tokens: number;
  entries: CostEntry[];
}

export interface ModelPricing {
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  cache_write_price_per_mtok: number;
  cache_read_price_per_mtok: number;
}

export interface PricingTable {
  [modelName: string]: ModelPricing;
} 