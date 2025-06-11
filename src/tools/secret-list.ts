import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { getStore } from "../store/plugin-store";

const schema = {
  name: "secret_list",
  description: "Lists all configured secrets (API keys, tokens, etc.) by name only, without exposing their values. Useful for checking what secrets are already configured.",
  input_schema: {
    type: "object",
    properties: {},
    required: []
  }
};

type SecretListToolInput = Record<string, never>;

export const secretListTool: ObsidianTool<SecretListToolInput> = {
  specification: schema,
  icon: "list",
  sideEffects: false, // Read-only operation, safe for link expansion
  get initialLabel() {
    return t('tools.secretList.labels.default');
  },
  execute: async (context: ToolExecutionContext<SecretListToolInput>): Promise<void> => {
    context.setLabel(t('tools.secretList.labels.inProgress'));

    try {
      // Get store instance
      const store = getStore();

      // Get all secret keys
      const secretKeys = store.getSecretKeys();

      if (secretKeys.length === 0) {
        context.setLabel(t('tools.secretList.labels.completed'));
        context.progress(t('tools.secretList.progress.noSecrets'));
        return;
      }

      // Sort keys alphabetically for consistent output
      const sortedKeys = secretKeys.sort();

      // Success message
      context.setLabel(t('tools.secretList.labels.completed'));
      
      // Build the list
      let resultMessage = t('tools.secretList.progress.header', { count: sortedKeys.length });
      resultMessage += '\n\n';
      
      sortedKeys.forEach((key: string, index: number) => {
        resultMessage += `${index + 1}. **${key}**\n`;
      });

      resultMessage += '\n' + t('tools.secretList.progress.securityNote');

      context.progress(resultMessage);

    } catch (error) {
      context.setLabel(t('tools.secretList.labels.failed'));
      throw error;
    }
  }
}; 