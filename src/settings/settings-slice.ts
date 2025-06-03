import { StateCreator } from 'zustand';
import { LifeNavigatorSettings } from './LifeNavigatorSettings';
import type { PluginStore } from '../store/plugin-store';
import * as CryptoJS from 'crypto-js';

// Hard-coded encryption key and IV generation
// ⚠️ Security Notice: This provides obfuscation, not strong security
// Anyone with access to the plugin source can extract this key
const ENCRYPTION_KEY = CryptoJS.enc.Hex.parse(
  "4c69666e617669676174696e673a537572766976696e674c6966654e6176694b6579323536"
);

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

// Settings slice interface
export interface SettingsSlice {
  // State
  settings: {
    settings: LifeNavigatorSettings;
    secrets: Record<string, string>;
    isLoading: boolean;
  };
  
  // Actions
  updateSettings: (updates: Partial<LifeNavigatorSettings>) => void;
  setSettings: (settings: LifeNavigatorSettings) => void;
  setSecret: (key: string, value: string) => Promise<void>;
  removeSecret: (key: string) => Promise<void>;
  setSecrets: (secrets: Record<string, string>) => void;
  setSettingsLoading: (loading: boolean) => void;
  resetSettings: () => void;
  saveSettings: () => Promise<void>;
  // New encryption-related actions
  encryptSecretsForStorage: (secrets: Record<string, string>) => Record<string, string>;
  decryptSecretsFromStorage: (encryptedSecrets: Record<string, string>) => Record<string, string>;
}

// Define the state creator type with immer
type ImmerStateCreator<T> = StateCreator<
  PluginStore,
  [["zustand/immer", never]],
  [],
  T
>;

// Create settings slice - now get() returns full PluginStore type
export const createSettingsSlice: ImmerStateCreator<SettingsSlice> = (set, get) => ({
  settings: {
    settings: new LifeNavigatorSettings(),
    secrets: {},
    isLoading: false
  },
  
  updateSettings: (updates) => set((state) => {
    Object.assign(state.settings.settings, updates);
  }),
  
  setSettings: (settings) => set((state) => {
    state.settings.settings = settings;
    state.settings.secrets = settings.secrets || {};
  }),
  
  setSecret: async (key, value) => {
    const state = get();
    
    // Update the store state
    set((state) => {
      state.settings.secrets[key] = value;
      // Also update the settings instance secrets
      if (!state.settings.settings.secrets) {
        state.settings.settings.secrets = {};
      }
      state.settings.settings.secrets[key] = value;
    });
    
    // Save to plugin data
    await state.settings.settings.saveSettings();
  },
  
  removeSecret: async (key) => {
    const state = get();
    
    // Update the store state
    set((state) => {
      delete state.settings.secrets[key];
      // Also update the settings instance secrets
      if (state.settings.settings.secrets) {
        delete state.settings.settings.secrets[key];
      }
    });
    
    // Save to plugin data
    await state.settings.settings.saveSettings();
  },
  
  setSecrets: (secrets) => set((state) => {
    state.settings.secrets = secrets;
    state.settings.settings.secrets = { ...secrets };
  }),
  
  setSettingsLoading: (loading) => set((state) => {
    state.settings.isLoading = loading;
  }),
  
  resetSettings: () => set((state) => {
    state.settings.settings = new LifeNavigatorSettings();
    state.settings.secrets = {};
    state.settings.isLoading = false;
  }),
  
  saveSettings: async () => {
    const state = get();
    await state.settings.settings.saveSettings();
  },

  // Encryption helper methods
  encryptSecretsForStorage: (secrets: Record<string, string>) => {
    return encryptSecrets(secrets);
  },

  decryptSecretsFromStorage: (encryptedSecrets: Record<string, string>) => {
    return decryptSecrets(encryptedSecrets);
  }
}); 