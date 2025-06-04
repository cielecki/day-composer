import { ImmerStateCreator } from '../store/plugin-store';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import * as CryptoJS from 'crypto-js';

export interface TutorialSettings {
	obsidianLanguageConfigured: boolean;
	openaiKeyConfigured: boolean; // Tracks if OpenAI has been configured or explicitly skipped
	// Future tutorial/setup related settings can be added here
}

// Hard-coded encryption key and IV generation
// ⚠️ Security Notice: This provides obfuscation, not strong security
// Anyone with access to the plugin source can extract this key
const ENCRYPTION_KEY = CryptoJS.enc.Hex.parse(
  "4c69666e617669676174696e673a537572766976696e674c6966654e6176694b6579323536"
);

export interface SettingsSlice {
  // State - moved from LifeNavigatorSettings class
  settings: {
    secrets: Record<string, string>;
    speechToTextPrompt: string;
    activeModeId: string;
    tutorial: TutorialSettings;
    isLoading: boolean;
  };
  
  // Actions - moved and expanded from LifeNavigatorSettings class
  updateSettings: (updates: Partial<{
    speechToTextPrompt: string;
    activeModeId: string;
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
  getOpenaiKeyConfigured: () => boolean;
  setOpenaiKeyConfigured: (value: boolean) => void;

  loadSettings: () => Promise<void>;
}

// Create settings slice - now contains all functionality from LifeNavigatorSettings
export const createSettingsSlice: ImmerStateCreator<SettingsSlice> = (set, get) => {

  function randomIv(): CryptoJS.lib.WordArray {
    return CryptoJS.lib.WordArray.random(16); // 128-bit IV
  }  

  /** Hash a label to create an opaque key for storage */
  function hashLabel(label: string): string {
    // Use first 24 hex chars (~12 bytes) to avoid collisions for small number of keys
    return CryptoJS.SHA256(label).toString(CryptoJS.enc.Hex).slice(0, 24);
  }

  /** Encrypt plaintext -> IV|cipher (both hex) joined by ":" */
  function encryptValue(plainText: string): string {
    const iv = randomIv();
    const cipher = CryptoJS.AES.encrypt(plainText, ENCRYPTION_KEY, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return iv.toString(CryptoJS.enc.Hex) + ":" + cipher.ciphertext.toString(CryptoJS.enc.Hex);
  }

  /** Decrypt IV|cipher (hex:hex) -> plaintext */
  function decryptValue(stored: string): string {
    const [ivHex, cipherHex] = stored.split(":");
    if (!ivHex || !cipherHex) {
      throw new Error("Invalid encrypted data format");
    }
    
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Hex.parse(cipherHex),
    });
    
    const plain = CryptoJS.AES.decrypt(cipherParams, ENCRYPTION_KEY, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    return plain.toString(CryptoJS.enc.Utf8);
  }

  /** Encrypt secrets object for storage */
  function encryptSecrets(secrets: Record<string, string>): Record<string, string> {
    const encrypted: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(secrets)) {
      // Embed the original key name inside the encrypted payload
      const payload = `${key}\n${value}`;
      const hashedKey = hashLabel(key);
      encrypted[hashedKey] = encryptValue(payload);
    }
    
    return encrypted;
  }

  /** Decrypt secrets object from storage */
  function decryptSecrets(encryptedSecrets: Record<string, string>): Record<string, string> {
    const decrypted: Record<string, string> = {};
    
    for (const [hashedKey, encryptedValue] of Object.entries(encryptedSecrets)) {
      try {
        const decryptedPayload = decryptValue(encryptedValue);
        const [key, value] = decryptedPayload.split('\n', 2);
        
        if (key && value !== undefined) {
          decrypted[key] = value;
        }
      } catch (error) {
        console.error('Failed to decrypt secret with hashed key:', hashedKey, error);
        // Continue with other secrets instead of failing completely
      }
    }
    
    return decrypted;
  }
  
  return {
    settings: {
      secrets: {},
      speechToTextPrompt: '',
      activeModeId: '',
      tutorial: {
        obsidianLanguageConfigured: false,
        openaiKeyConfigured: false
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
      state.settings.activeModeId = '';
      state.settings.tutorial = {
        obsidianLanguageConfigured: false,
        openaiKeyConfigured: false
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
            // Encrypt the secrets and store under 'encryptedSecrets' key
            const encryptedSecrets = encryptSecrets(state.settings.secrets);
            (dataToSave as any).encryptedSecrets = encryptedSecrets;
            
            // Remove plain text secrets from storage
            delete (dataToSave as any).secrets;
            
            console.log('Secrets encrypted for storage. Count:', Object.keys(state.settings.secrets).length);
          } catch (error) {
            console.error('Failed to encrypt secrets, falling back to plain text storage:', error);
            // Fallback: keep plain text secrets if encryption fails
          }
        } else {
          // No secrets to encrypt, ensure both are cleared
          delete (dataToSave as any).secrets;
          delete (dataToSave as any).encryptedSecrets;
        }
    
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
          openaiKeyConfigured: false
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

    getOpenaiKeyConfigured: () => {
      const state = get();
      return state.settings.tutorial.openaiKeyConfigured;
    },

    setOpenaiKeyConfigured: (value) => set((state) => {
      state.settings.tutorial.openaiKeyConfigured = value;
    }),



    // Loading function for settings - replaces loadPluginSettings
    loadSettings: async() => {
      // Load existing settings
      const data = await LifeNavigatorPlugin.getInstance().loadData() || {};
      
      // First, safely copy non-conflicting properties
      const { openAIApiKey, anthropicApiKey, firecrawlApiKey, secrets: plainTextSecrets, encryptedSecrets, ...safeData } = data as any;
      
      // Update settings with safe data
      get().updateSettings(safeData);

      let migrationOccurred = false;
      let loadedSecrets: Record<string, string> = {};

      // Step 1: Handle encrypted secrets if they exist
      if (encryptedSecrets && typeof encryptedSecrets === 'object') {
        try {
          // Decrypt secrets from storage
          const decryptedSecrets = decryptSecrets(encryptedSecrets);
          Object.assign(loadedSecrets, decryptedSecrets);
          
          console.log('Decrypted secrets from storage. Count:', Object.keys(decryptedSecrets).length);
        } catch (error) {
          console.error('Failed to decrypt secrets from storage:', error);
          // Continue without encrypted secrets if decryption fails
        }
      }

      // Step 2: Migration - handle old individual API keys format only (no plain text secrets support)
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

      // Log if plain text secrets were found (but don't migrate them since this format was never released)
      if (plainTextSecrets && typeof plainTextSecrets === 'object') {
        console.warn('Found plain text secrets object in data.json - this format is not supported. Secrets should be encrypted or use the old individual API key format.');
      }

      // Set the loaded secrets
      if (Object.keys(loadedSecrets).length > 0) {
        get().setSecrets(loadedSecrets);
      }

      // Save settings if migration occurred to persist encrypted format and remove old keys
      if (migrationOccurred) {
        console.log('Migration completed. Saving encrypted secrets...');
        await get().saveSettings();
      }
    },
  };
};
