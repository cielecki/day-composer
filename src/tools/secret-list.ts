import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";
import { getPluginSettings } from "../settings/LifeNavigatorSettings";

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
  initialLabel: t('tools.actions.secretList.default'),
  execute: async (context: ToolExecutionContext<SecretListToolInput>): Promise<void> => {
    context.setLabel(t('tools.actions.secretList.inProgress'));

    try {
      // Get settings instance
      const settings = getPluginSettings();

      // Get all secret keys
      const secretKeys = settings.getSecretKeys();

      if (secretKeys.length === 0) {
        context.setLabel(t('tools.actions.secretList.completed'));
        context.progress(t('tools.secretList.progress.noSecrets'));
        return;
      }

      // Sort keys alphabetically for consistent output
      const sortedKeys = secretKeys.sort();

      // Success message
      context.setLabel(t('tools.actions.secretList.completed'));
      
      // Build the list
      let resultMessage = t('tools.secretList.progress.header', { count: sortedKeys.length });
      resultMessage += '\n\n';
      
      sortedKeys.forEach((key, index) => {
        resultMessage += `${index + 1}. **${key}**\n`;
      });

      resultMessage += '\n' + t('tools.secretList.progress.securityNote');

      context.progress(resultMessage);

    } catch (error) {
      context.setLabel(t('tools.actions.secretList.failed'));
      throw error;
    }
  }
}; 