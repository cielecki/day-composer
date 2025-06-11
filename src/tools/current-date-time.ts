import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { handleCurrentDateTimeLink } from '../utils/links/special-link-handlers';

const schema = {
  name: "current_date_time",
  description: "Returns the current date and time in a formatted, human-readable format using the user's locale settings.",
  input_schema: {
    type: "object",
    properties: {},
    required: []
  }
};

type CurrentDateTimeInput = Record<string, never>;

export const currentDateTimeTool: ObsidianTool<CurrentDateTimeInput> = {
  specification: schema,
  icon: "clock",
  sideEffects: false, // Read-only operation, safe for link expansion
  get initialLabel() {
    return t('tools.currentDateTime.labels.initial');
  },
  execute: async (context: ToolExecutionContext<CurrentDateTimeInput>): Promise<void> => {
    context.setLabel(t('tools.currentDateTime.labels.inProgress'));

    try {
      // Use the exact same logic as the original special link handler
      const result = handleCurrentDateTimeLink();

      context.setLabel(t('tools.currentDateTime.labels.completed'));
      context.progress(result);

    } catch (error) {
      context.setLabel(t('tools.currentDateTime.labels.failed'));
      throw error;
    }
  }
}; 