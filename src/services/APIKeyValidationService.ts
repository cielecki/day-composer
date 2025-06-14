import { requestUrl } from 'obsidian';
import { t } from '../i18n';

export interface APIKeyValidationResult {
  valid: boolean;
  reason?: string; // Already translated reason
  error?: string;
}

export interface APIKeyValidationService {
  validateOpenAIKey(apiKey: string): Promise<APIKeyValidationResult>;
  validateAnthropicKey(apiKey: string): Promise<APIKeyValidationResult>;
  validateElevenLabsKey(apiKey: string): Promise<APIKeyValidationResult>;
}

class APIKeyValidationServiceImpl implements APIKeyValidationService {
  private async makeRequest(url: string, headers: Record<string, string>): Promise<APIKeyValidationResult> {
    try {
      const response = await requestUrl({
        url,
        method: 'GET',
        headers,
      });

      // Per documentation: 200 or 403 means valid key
      if (response.status === 200 || response.status === 403) {
        return { valid: true };
      }

      // Handle other success-like status codes (429 means valid key but quota exceeded)
      if (response.status === 429) {
        const body = typeof response.json === 'object' ? response.json : {};
        const errorMessage = body?.error?.message || `HTTP ${response.status}`;
        return { 
          valid: true, // Key is valid but quota exceeded
          reason: t('ui.setup.validation.reasons.quotaExceeded'),
          error: errorMessage 
        };
      }

      // Other status codes indicate API issues
      const body = typeof response.json === 'object' ? response.json : {};
      const errorMessage = body?.error?.message || `HTTP ${response.status}`;
      return { 
        valid: false, 
        reason: t('ui.setup.validation.reasons.unexpectedResponse'),
        error: errorMessage 
      };
    } catch (error) {
      console.error('API key validation error:', error);
      
      // Check if this is an HTTP error (requestUrl throws on 4xx/5xx status codes)
      if (error instanceof Error && error.message.includes('Request failed, status')) {
        const statusMatch = error.message.match(/status (\d+)/);
        if (statusMatch) {
          const status = parseInt(statusMatch[1]);
          
          if (status === 401) {
            return { 
              valid: false, 
              reason: t('ui.setup.validation.reasons.invalidOrExpired'),
              error: 'Authentication failed'
            };
          }
          
          if (status === 403) {
            return { valid: true }; // Valid key but forbidden action
          }
          
          if (status === 429) {
            return { 
              valid: true, // Key is valid but quota exceeded
              reason: t('ui.setup.validation.reasons.quotaExceeded'),
              error: 'Rate limit exceeded'
            };
          }
        }
      }
      
      // Network or other errors
      return { 
        valid: false, 
        reason: t('ui.setup.validation.reasons.networkError'),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async validateOpenAIKey(apiKey: string): Promise<APIKeyValidationResult> {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return { 
        valid: false, 
        reason: t('ui.setup.validation.reasons.invalidOrExpired'),
        error: 'Empty or invalid key format' 
      };
    }

    const trimmedKey = apiKey.trim();
    return this.makeRequest('https://api.openai.com/v1/models', {
      'Authorization': `Bearer ${trimmedKey}`,
      'Content-Type': 'application/json'
    });
  }

  async validateAnthropicKey(apiKey: string): Promise<APIKeyValidationResult> {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return { 
        valid: false, 
        reason: t('ui.setup.validation.reasons.invalidOrExpired'),
        error: 'Empty or invalid key format' 
      };
    }

    const trimmedKey = apiKey.trim();
    return this.makeRequest('https://api.anthropic.com/v1/models', {
      'x-api-key': trimmedKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    });
  }

  async validateElevenLabsKey(apiKey: string): Promise<APIKeyValidationResult> {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return { 
        valid: false, 
        reason: t('ui.setup.validation.reasons.invalidOrExpired'),
        error: 'Empty or invalid key format' 
      };
    }

    const trimmedKey = apiKey.trim();
    return this.makeRequest('https://api.elevenlabs.io/v1/voices', {
      'xi-api-key': trimmedKey,
      'Content-Type': 'application/json'
    });
  }
}

// Export singleton instance
export const apiKeyValidationService = new APIKeyValidationServiceImpl(); 