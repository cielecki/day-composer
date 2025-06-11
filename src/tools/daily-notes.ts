import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { handleDayNoteRangeLink } from '../utils/links/special-link-handlers';
import { processFileLink } from '../utils/links/process-file-link';

const schema = {
  name: "daily_notes",
  description: "Retrieves content from multiple daily notes based on a date range. Takes start and end offsets from today to create a range of daily notes.",
  input_schema: {
    type: "object",
    properties: {
      start_offset: {
        type: "integer",
        description: "Start day offset from today. Negative numbers are past dates, positive are future dates."
      },
      end_offset: {
        type: "integer", 
        description: "End day offset from today. Should be greater than or equal to start_offset."
      }
    },
    required: ["start_offset", "end_offset"]
  }
};

type DailyNotesInput = {
  start_offset: number;
  end_offset: number;
};

export const dailyNotesTool: ObsidianTool<DailyNotesInput> = {
  specification: schema,
  icon: "calendar",
  sideEffects: false, // Read-only operation, safe for link expansion
  get initialLabel() {
    return t('tools.dailyNotes.labels.initial');
  },
  execute: async (context: ToolExecutionContext<DailyNotesInput>): Promise<void> => {
    const { plugin, params } = context;
    const { start_offset, end_offset } = params;

    context.setLabel(t('tools.dailyNotes.labels.inProgress', { start: start_offset, end: end_offset }));

    try {
      const rangeInfo = handleDayNoteRangeLink(plugin.app, start_offset, end_offset);
      
      if (rangeInfo.notes.length > 0) {
        // Process each individual daily note in the range
        let combinedContent = '';
        let foundCount = 0;
        
        for (const noteInfo of rangeInfo.notes) {
          if (noteInfo.found) {
            const expandedContent = await processFileLink(
              plugin.app,
              noteInfo.linkPath,
              `${noteInfo.dateStr} (${noteInfo.descriptiveLabel})`,
              new Set(), // Empty visited paths set
              true, // This is a day note
              { formattedDate: noteInfo.formattedDate, descriptiveLabel: noteInfo.descriptiveLabel }
            );
            
            if (expandedContent) {
              combinedContent += expandedContent + '\n\n';
              foundCount++;
              
              // Add navigation target for each found note
              context.addNavigationTarget({
                filePath: noteInfo.linkPath + '.md'
              });
            }
          } else {
            // Add individual marker for missing note using consistent XML format
            combinedContent += `<daily_note_missing date="${noteInfo.dateStr}" label="${noteInfo.descriptiveLabel}" offset="${noteInfo.offset}" />\n\n`;
          }
        }
        
        context.setLabel(t('tools.dailyNotes.labels.completed', { 
          found: foundCount, 
          total: rangeInfo.notes.length,
          range: rangeInfo.rangeLabel 
        }));
        context.progress(combinedContent.trim());
      } else {
        // No notes in range (shouldn't happen with current logic)
        context.setLabel(t('tools.dailyNotes.labels.failed', { start: start_offset, end: end_offset }));
        context.progress(`No daily notes found for range ${start_offset} to ${end_offset}`);
      }

    } catch (error) {
      context.setLabel(t('tools.dailyNotes.labels.failed', { start: start_offset, end: end_offset }));
      throw error;
    }
  }
}; 