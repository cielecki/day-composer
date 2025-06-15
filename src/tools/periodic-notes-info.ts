import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { getDailyNoteSettings } from 'obsidian-daily-notes-interface';
import { getPeriodicNotesSettings } from '../utils/periodic-notes/get-periodic-notes-settings';
import { getPeriodicNotesPluginStatus } from '../utils/periodic-notes/is-periodic-notes-enabled';
import moment from 'moment';

const schema = {
  name: "periodic_notes_info",
  description: "Get information about periodic notes configuration including daily, weekly, monthly, quarterly, and yearly notes settings. Shows folder locations, formats, and example paths for each note type.",
  input_schema: {
    type: "object",
    properties: {},
    required: []
  }
};

type PeriodicNotesInfoInput = {};

export const periodicNotesInfoTool: ObsidianTool<PeriodicNotesInfoInput> = {
  specification: schema,
  icon: "calendar",
  sideEffects: false, // Read-only operation, safe for link expansion
  get initialLabel() {
    return t('tools.periodicNotesInfo.labels.initial');
  },
  execute: async (context: ToolExecutionContext<PeriodicNotesInfoInput>): Promise<void> => {
    context.setLabel(t('tools.periodicNotesInfo.labels.inProgress'));

    try {
      // Get current date for examples
      const now = moment();
      const currentDate = now.format('MMMM D, YYYY');

      // Get daily notes settings using the interface
      const dailySettings = getDailyNoteSettings();

      // Get periodic notes settings  
      const periodicSettings = await getPeriodicNotesSettings();

      // Get plugin status
      const pluginStatus = getPeriodicNotesPluginStatus();

      // Build output string
      let output = "**Periodic Notes Configuration**\n\n";

      // Daily Notes
      output += "**Daily Notes:**\n";
      output += `- Enabled: ${pluginStatus.daily ? 'Yes' : 'No'}\n`;
      if (pluginStatus.daily) {
        output += `- Folder: ${dailySettings.folder || 'Root folder'}\n`;
        output += `- Format: ${dailySettings.format || 'YYYY-MM-DD'}\n`;
        const todayPath = dailySettings.folder 
          ? `${dailySettings.folder}/${now.format(dailySettings.format || 'YYYY-MM-DD')}.md`
          : `${now.format(dailySettings.format || 'YYYY-MM-DD')}.md`;
        output += `- Today's path: ${todayPath}\n`;
      }
      output += "\n";

      // Weekly Notes
      output += "**Weekly Notes:**\n";
      output += `- Enabled: ${pluginStatus.weekly ? 'Yes' : 'No'}\n`;
      if (pluginStatus.weekly) {
        output += `- Folder: ${periodicSettings.weekly.folder || 'Root folder'}\n`;
        output += `- Format: ${periodicSettings.weekly.format}\n`;
        const weekPath = periodicSettings.weekly.folder 
          ? `${periodicSettings.weekly.folder}/${now.format(periodicSettings.weekly.format)}.md`
          : `${now.format(periodicSettings.weekly.format)}.md`;
        output += `- This week's path: ${weekPath}\n`;
      }
      output += "\n";

      // Monthly Notes
      output += "**Monthly Notes:**\n";
      output += `- Enabled: ${pluginStatus.monthly ? 'Yes' : 'No'}\n`;
      if (pluginStatus.monthly) {
        output += `- Folder: ${periodicSettings.monthly.folder || 'Root folder'}\n`;
        output += `- Format: ${periodicSettings.monthly.format}\n`;
        const monthPath = periodicSettings.monthly.folder 
          ? `${periodicSettings.monthly.folder}/${now.format(periodicSettings.monthly.format)}.md`
          : `${now.format(periodicSettings.monthly.format)}.md`;
        output += `- This month's path: ${monthPath}\n`;
      }
      output += "\n";

      // Quarterly Notes
      output += "**Quarterly Notes:**\n";
      output += `- Enabled: ${pluginStatus.quarterly ? 'Yes' : 'No'}\n`;
      if (pluginStatus.quarterly) {
        output += `- Folder: ${periodicSettings.quarterly.folder || 'Root folder'}\n`;
        output += `- Format: ${periodicSettings.quarterly.format}\n`;
        const quarterPath = periodicSettings.quarterly.folder 
          ? `${periodicSettings.quarterly.folder}/${now.format(periodicSettings.quarterly.format)}.md`
          : `${now.format(periodicSettings.quarterly.format)}.md`;
        output += `- This quarter's path: ${quarterPath}\n`;
      }
      output += "\n";

      // Yearly Notes
      output += "**Yearly Notes:**\n";
      output += `- Enabled: ${pluginStatus.yearly ? 'Yes' : 'No'}\n`;
      if (pluginStatus.yearly) {
        output += `- Folder: ${periodicSettings.yearly.folder || 'Root folder'}\n`;
        output += `- Format: ${periodicSettings.yearly.format}\n`;
        const yearPath = periodicSettings.yearly.folder 
          ? `${periodicSettings.yearly.folder}/${now.format(periodicSettings.yearly.format)}.md`
          : `${now.format(periodicSettings.yearly.format)}.md`;
        output += `- This year's path: ${yearPath}\n`;
      }
      output += "\n";

      context.setLabel(t('tools.periodicNotesInfo.labels.completed'));
      context.progress(output);

    } catch (error) {
      context.setLabel(t('tools.periodicNotesInfo.labels.failed'));
      throw error;
    }
  }
}; 