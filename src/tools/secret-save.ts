import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { getStore } from "../store/plugin-store";

const schema = {
  name: "secret_save",
  description: "Saves a secret (API key, token, password, etc.) to the plugin's secure storage system. The secret will be available to user-defined tools via the getSecret() function.",
  input_schema: {
    type: "object",
    properties: {
      secret_key: {
        type: "string",
        description: "The name/identifier for the secret (e.g., 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MY_SECRET_TOKEN'). Use uppercase with underscores for consistency.",
      },
      secret_value: {
        type: "string",
        description: "The actual secret value to store (e.g., API key, token, password)",
      },
      description: {
        type: "string",
        description: "Optional description of what this secret is used for",
        default: ""
      },
    },
    required: ["secret_key", "secret_value"]
  }
};

type SecretSaveToolInput = {
  secret_key: string;
  secret_value: string;
  description?: string;
};

function validateSecretKey(key: string): void {
  if (!key || key.trim().length === 0) {
    throw new ToolExecutionError("Secret key cannot be empty.");
  }
  
  // Check for valid characters (alphanumeric, underscore, hyphen)
  if (!/^[A-Z0-9_-]+$/i.test(key)) {
    throw new ToolExecutionError("Secret key can only contain letters, numbers, underscores, and hyphens.");
  }
  
  // Recommend uppercase format
  if (key !== key.toUpperCase()) {
    throw new ToolExecutionError(`Secret key should be uppercase for consistency. Consider using "${key.toUpperCase()}" instead.`);
  }
}

export const secretSaveTool: ObsidianTool<SecretSaveToolInput> = {
  specification: schema,
  icon: "key",
  sideEffects: true, // Modifies stored secrets
  get initialLabel() {
    return t('tools.actions.secretSave.default');
  },
  execute: async (context: ToolExecutionContext<SecretSaveToolInput>): Promise<void> => {
    const { params } = context;
    const { secret_key, secret_value, description = "" } = params;

    context.setLabel(t('tools.actions.secretSave.inProgress', { key: secret_key }));

    try {
      // Validate input
      if (!secret_key || !secret_key.trim()) {
        throw new ToolExecutionError("Secret key cannot be empty");
      }
      
      if (!secret_value || !secret_value.trim()) {
        throw new ToolExecutionError("Secret value cannot be empty");
      }
      
      // Use store to save the secret
      const store = getStore();
      await store.setSecret(secret_key.trim(), secret_value.trim());
      
      // Success message
      context.setLabel(t('tools.actions.secretSave.completed', { key: secret_key }));
      
      let successMessage = t('tools.secretSave.progress.success', { key: secret_key });
      if (description && description.trim().length > 0) {
        successMessage += ` (${description})`;
      }
      
      context.progress(successMessage);
      
      // Security reminder
      context.progress(t('tools.secretSave.progress.securityReminder'));

    } catch (error) {
      context.setLabel(t('tools.actions.secretSave.failed', { key: secret_key }));
      throw error;
    }
  }
}; 