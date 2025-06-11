import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { handleCurrentChatLink } from '../utils/links/special-link-handlers';

const schema = {
  name: "current_chat",
  description: "Returns the content of the current chat conversation. Useful for referencing the ongoing conversation context in tool calls.",
  input_schema: {
    type: "object",
    properties: {},
    required: []
  }
};

type CurrentChatInput = Record<string, never>;

export const currentChatTool: ObsidianTool<CurrentChatInput> = {
  specification: schema,
  icon: "message-circle",
  sideEffects: false, // Read-only operation, safe for link expansion
  get initialLabel() {
    return t('tools.currentChat.labels.initial');
  },
  execute: async (context: ToolExecutionContext<CurrentChatInput>): Promise<void> => {
    const { plugin } = context;

    context.setLabel(t('tools.currentChat.labels.inProgress'));

    try {
      // Use the exact same logic as the original special link handler
      const chatContent = handleCurrentChatLink(plugin.app);
      
      context.setLabel(t('tools.currentChat.labels.completed'));
      context.progress(chatContent);

    } catch (error) {
      context.setLabel(t('tools.currentChat.labels.failed'));
      throw error;
    }
  }
}; 