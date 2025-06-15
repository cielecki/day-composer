import CryptoJS from 'crypto-js';
import type { ImmerStateCreator } from './plugin-store';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { apiKeyValidationService, type APIKeyValidationResult } from '../services/APIKeyValidationService';

export interface TutorialSettings {
	obsidianLanguageConfigured: boolean;
	openaiKeySkipped?: boolean; // Tracks if user explicitly skipped OpenAI configuration
	// Future tutorial/setup related settings can be added here
}

// Hard-coded encryption key for secrets
// ⚠️ Security Notice: This provides obfuscation, not strong security
// Anyone with access to the plugin source can extract this key
// Use SHA256 to ensure exactly 32 bytes for AES-256
const ENCRYPTION_KEY = CryptoJS.SHA256("life-navigator-secrets-key-v1");



export interface SettingsSlice {
  // State - moved from LifeNavigatorSettings class
  settings: {
    secrets: Record<string, string>;
    speechToTextPrompt: string;
    tutorial: TutorialSettings;
    isLoading: boolean;
    lastViewedWhatsNewVersion?: string;
  };
  
  // Actions - moved and expanded from LifeNavigatorSettings class
  updateSettings: (updates: Partial<{
    speechToTextPrompt: string;
    tutorial: TutorialSettings;
  }>) => void;
  setSecret: (key: string, value: string) => Promise<void>;
  removeSecret: (key: string) => Promise<void>;
  setSecrets: (secrets: Record<string, string>) => void;
  setSettingsLoading: (loading: boolean) => void;
  resetSettings: () => void;
  saveSettings: () => Promise<void>;
  
  // Secret management methods from LifeNavigatorSettings
  getSecretKeys: () => string[];
  getSecret: (key: string) => string | undefined;
  
  // Tutorial methods from LifeNavigatorSettings
  resetTutorial: () => Promise<void>;
  
  // Backward compatibility getters/setters
  getObsidianLanguageConfigured: () => boolean;
  setObsidianLanguageConfigured: (value: boolean) => void;
  
  // What's New version tracking
  getLastViewedWhatsNewVersion: () => string | undefined;
  setLastViewedWhatsNewVersion: (version: string) => Promise<void>;

  // API Key validation methods
  validateOpenAIKey: (apiKey: string) => Promise<APIKeyValidationResult>;
  validateAnthropicKey: (apiKey: string) => Promise<APIKeyValidationResult>;
  validateElevenLabsKey: (apiKey: string) => Promise<APIKeyValidationResult>;

  loadSettings: () => Promise<void>;
}

// Create settings slice - now contains all functionality from LifeNavigatorSettings
export const createSettingsSlice: ImmerStateCreator<SettingsSlice> = (set, get) => {

  function randomIv(): CryptoJS.lib.WordArray {
    return CryptoJS.lib.WordArray.random(16); // 128-bit IV
  }  

  /** Encrypt secrets object -> IV:cipher (both hex) */
  function encryptSecrets(secrets: Record<string, string>): string {
    const plaintext = JSON.stringify(secrets);
    const iv = randomIv();
    const cipher = CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return iv.toString(CryptoJS.enc.Hex) + ":" + cipher.ciphertext.toString(CryptoJS.enc.Hex);
  }

  /** Decrypt IV:cipher (hex:hex) -> secrets object */
  function decryptSecrets(encryptedData: string): Record<string, string> {
    const [ivHex, cipherHex] = encryptedData.split(":");
    if (!ivHex || !cipherHex) {
      throw new Error("Invalid encrypted data format");
    }
    
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const ciphertext = CryptoJS.enc.Hex.parse(cipherHex);
    
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext
    });
    
    const plain = CryptoJS.AES.decrypt(
      cipherParams, 
      ENCRYPTION_KEY, 
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    
    const decryptedText = plain.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText || decryptedText.length === 0) {
      throw new Error("Decryption failed - empty result");
    }
    
    return JSON.parse(decryptedText);
  }
  
  return {
    settings: {
      secrets: {},
      speechToTextPrompt: '',
      tutorial: {
        obsidianLanguageConfigured: false,
        openaiKeySkipped: false
      },
      isLoading: false
    },
    
    updateSettings: (updates) => set((state) => {
      Object.assign(state.settings, updates);
    }),
    
    setSecret: async (key, value) => {
      set((state) => {
        state.settings.secrets[key] = value;
      });
      
      await get().saveSettings();
    },
    
    removeSecret: async (key) => {
      set((state) => {
        delete state.settings.secrets[key];
      });
      
      await get().saveSettings();
    },
    
    setSecrets: (secrets) => set((state) => {
      state.settings.secrets = secrets;
    }),
    
    setSettingsLoading: (loading) => set((state) => {
      state.settings.isLoading = loading;
    }),
    
    resetSettings: () => set((state) => {
      state.settings.secrets = {};
      state.settings.speechToTextPrompt = '';
      state.settings.tutorial = {
        obsidianLanguageConfigured: false,
        openaiKeySkipped: false
      };
      state.settings.isLoading = false;
    }),
    
    saveSettings: async () => {
        const state = get();
        
        // Create a copy of the current settings and remove properties that shouldn't be serialized
        const dataToSave = { ...state.settings };
        
        // Remove legacy API key properties
        delete (dataToSave as any).openAIApiKey;
        delete (dataToSave as any).anthropicApiKey;
        delete (dataToSave as any).firecrawlApiKey;
        
        // Remove the plugin reference as it shouldn't be serialized
        delete (dataToSave as any).plugin;
        delete (dataToSave as any).isLoading;
        
        // Encrypt secrets before saving
        if (state.settings.secrets && Object.keys(state.settings.secrets).length > 0) {
          try {
            // Encrypt the entire secrets object and store under 's' key
            const encryptedSecrets = encryptSecrets(state.settings.secrets);
            (dataToSave as any).s = encryptedSecrets;
          } catch (error) {
            console.error('Failed to encrypt secrets:', error);
            throw error; // Don't save if encryption fails
          }
        } else {
          // No secrets to encrypt, ensure encrypted field is cleared
          delete (dataToSave as any).s;
        }
        
        // Remove secrets from data to save (they're now encrypted in 's')
        delete (dataToSave as any).secrets;
    
        await LifeNavigatorPlugin.getInstance().saveData(dataToSave);
    },

      // Secret management methods
    getSecretKeys: () => {
      const state = get();
      return Object.keys(state.settings.secrets || {});
    },

    getSecret: (key) => {
      const state = get();
      return state.settings.secrets?.[key];
    },

    // Tutorial methods
    resetTutorial: async () => {
      set((state) => {
        state.settings.tutorial = {
          obsidianLanguageConfigured: false,
          openaiKeySkipped: false
        };
      });
      await get().saveSettings();
    },

    // Backward compatibility getters/setters
    getObsidianLanguageConfigured: () => {
      const state = get();
      return state.settings.tutorial.obsidianLanguageConfigured;
    },

    setObsidianLanguageConfigured: (value) => set((state) => {
      state.settings.tutorial.obsidianLanguageConfigured = value;
    }),

    // What's New version tracking methods
    getLastViewedWhatsNewVersion: () => {
      const state = get();
      return state.settings.lastViewedWhatsNewVersion;
    },

    setLastViewedWhatsNewVersion: async (version) => {
      set((state) => {
        state.settings.lastViewedWhatsNewVersion = version;
      });
      await get().saveSettings();
    },

    // API Key validation methods
    validateOpenAIKey: async (apiKey) => {
      return await apiKeyValidationService.validateOpenAIKey(apiKey);
    },

    validateAnthropicKey: async (apiKey) => {
      return await apiKeyValidationService.validateAnthropicKey(apiKey);
    },

    validateElevenLabsKey: async (apiKey) => {
      return await apiKeyValidationService.validateElevenLabsKey(apiKey);
    },

    // Loading function for settings - replaces loadPluginSettings
    loadSettings: async() => {
      // Load existing settings
      const data = await LifeNavigatorPlugin.getInstance().loadData() || {};
      
      // First, safely copy non-conflicting properties
      const { openAIApiKey, anthropicApiKey, firecrawlApiKey, s: encryptedSecrets, ...safeData } = data as any;
      
      // Update settings with safe data
      get().updateSettings(safeData);

      let migrationOccurred = false;
      let loadedSecrets: Record<string, string> = {};

      // Step 1: Handle encrypted secrets if they exist
      if (encryptedSecrets && typeof encryptedSecrets === 'string') {
        try {
          const decryptedSecrets = decryptSecrets(encryptedSecrets);
          Object.assign(loadedSecrets, decryptedSecrets);
        } catch (error) {
          console.error('Failed to decrypt secrets from storage:', error);
          // Continue without encrypted secrets if decryption fails
        }
      }

      // Step 2: Migration - handle old individual API keys format
      if (openAIApiKey) {
        loadedSecrets['OPENAI_API_KEY'] = openAIApiKey;
        migrationOccurred = true;
      }
      
      if (anthropicApiKey) {
        loadedSecrets['ANTHROPIC_API_KEY'] = anthropicApiKey;
        migrationOccurred = true;
      }
      
      if (firecrawlApiKey) {
        loadedSecrets['FIRECRAWL_API_KEY'] = firecrawlApiKey;
        migrationOccurred = true;
      }

      // Set the loaded secrets
      if (Object.keys(loadedSecrets).length > 0) {
        get().setSecrets(loadedSecrets);
        // Always save after setting secrets to ensure persistence
        await get().saveSettings();
      } else if (migrationOccurred) {
        // Save settings if migration occurred to persist encrypted format and remove old keys
        await get().saveSettings();
      }
    },
  };
};
