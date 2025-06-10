import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { handleDayNoteLink } from '../utils/links/special-link-handlers';
import { processFileLink } from '../utils/links/process-file-link';

const schema = {
  name: "daily_note",
  description: "Retrieves the content of a single daily note based on a day offset from today. Positive numbers are future dates, negative are past dates, and 0 is today.",
  input_schema: {
    type: "object",
    properties: {
      offset: {
        type: "integer",
        description: "Number of days offset from today. 0 = today, -1 = yesterday, 1 = tomorrow, etc."
      }
    },
    required: ["offset"]
  }
};

type DailyNoteInput = {
  offset: number;
};

export const dailyNoteTool: ObsidianTool<DailyNoteInput> = {
  specification: schema,
  icon: "calendar",
  sideEffects: false, // Read-only operation, safe for link expansion
  get initialLabel() {
    return t('tools.dayNote.label');
  },
  execute: async (context: ToolExecutionContext<DailyNoteInput>): Promise<void> => {
    const { plugin, params } = context;
    const { offset } = params;

    context.setLabel(t('tools.dayNote.inProgress', { offset }));

    try {
      const dayNoteInfo = handleDayNoteLink(plugin.app, offset);
      
      if (dayNoteInfo && dayNoteInfo.found) {
        const expandedContent = await processFileLink(
          plugin.app,
          dayNoteInfo.linkPath,
          `${dayNoteInfo.dateStr} (${dayNoteInfo.descriptiveLabel})`,
          new Set(), // Empty visited paths set
          true, // This is a day note
          { formattedDate: dayNoteInfo.formattedDate, descriptiveLabel: dayNoteInfo.descriptiveLabel }
        );
        
        if (expandedContent) {
          context.setLabel(t('tools.dayNote.completed', { date: dayNoteInfo.descriptiveLabel }));
          context.progress(expandedContent);
          
          // Add navigation target
          context.addNavigationTarget({
            filePath: dayNoteInfo.linkPath + '.md', // Add extension for navigation
            description: t('tools.navigation.openDayNote', { date: dayNoteInfo.descriptiveLabel })
          });
        } else {
          context.setLabel(t('tools.dayNote.failed', { offset }));
          context.progress(`<daily_note_missing date="${dayNoteInfo.dateStr}" label="${dayNoteInfo.descriptiveLabel}" offset="${dayNoteInfo.offset}" />`);
        }
      } else {
        // No matching file found
        const dateStr = dayNoteInfo?.dateStr || "unknown date";
        const descriptiveLabel = dayNoteInfo?.descriptiveLabel || "unknown";
        const offsetValue = dayNoteInfo?.offset || offset;
        
        context.setLabel(t('tools.dayNote.notFound', { date: descriptiveLabel }));
        context.progress(`<daily_note_missing date="${dateStr}" label="${descriptiveLabel}" offset="${offsetValue}" />`);
      }

    } catch (error) {
      context.setLabel(t('tools.dayNote.failed', { offset }));
      throw error;
    }
  }
}; 