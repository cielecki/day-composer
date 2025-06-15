import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { handlePeriodicNotesRange } from '../utils/periodic-notes/periodic-note-finder';
import { processFileLink } from '../utils/links/process-file-link';
import { PeriodType, FlexibleDate, OffsetUnit, translatePeriodTypes, translatePeriodType } from '../utils/periodic-notes/periodic-note-calculator';

const schema = {
  name: "periodic_notes",
  description: "Retrieves content from multiple types of periodic notes (daily, weekly, monthly, quarterly, yearly) within a flexible date range. Supports both absolute dates and relative offsets with units.",
  input_schema: {
    type: "object",
    properties: {
      types: {
        type: "array",
        items: {
          type: "string",
          enum: ["daily", "weekly", "monthly", "quarterly", "yearly"]
        },
        description: "Array of periodic note types to retrieve. Can include multiple types in one call.",
        minItems: 1
      },
      start_date: {
        oneOf: [
          {
            type: "string",
            format: "date",
            description: "Start date in ISO format (YYYY-MM-DD)"
          },
          {
            type: "object",
            properties: {
              offset: {
                type: "integer",
                description: "Number of units to offset from today (negative for past, positive for future)"
              },
              unit: {
                type: "string",
                enum: ["days", "months", "years"],
                description: "Unit for the offset calculation"
              }
            },
            required: ["offset", "unit"],
            description: "Relative offset from today with unit specification"
          }
        ],
        description: "Start date: either absolute date (YYYY-MM-DD) or relative offset object"
      },
      end_date: {
        oneOf: [
          {
            type: "string",
            format: "date",
            description: "End date in ISO format (YYYY-MM-DD)"
          },
          {
            type: "object",
            properties: {
              offset: {
                type: "integer",
                description: "Number of units to offset from today (negative for past, positive for future)"
              },
              unit: {
                type: "string",
                enum: ["days", "months", "years"],
                description: "Unit for the offset calculation"
              }
            },
            required: ["offset", "unit"],
            description: "Relative offset from today with unit specification"
          }
        ],
        description: "End date: either absolute date (YYYY-MM-DD) or relative offset object"
      }
    },
    required: ["types", "start_date", "end_date"]
  }
};

type PeriodicNotesInput = {
  types: PeriodType[];
  start_date: FlexibleDate;
  end_date: FlexibleDate;
};

export const periodicNotesTool: ObsidianTool<PeriodicNotesInput> = {
  specification: schema,
  icon: "calendar",
  sideEffects: false, // Read-only operation, safe for link expansion
  get initialLabel() {
    return t('tools.periodicNotes.labels.initial');
  },
  execute: async (context: ToolExecutionContext<PeriodicNotesInput>): Promise<void> => {
    const { plugin, params } = context;
    const { types, start_date, end_date } = params;

    // Create display strings for the parameters using translations
    const typesDisplay = translatePeriodTypes(types);
    
    const formatDateDisplay = (date: FlexibleDate): string => {
      if (typeof date === 'string') {
        return date;
      } else {
        const sign = date.offset >= 0 ? '+' : '';
        return `${sign}${date.offset} ${date.unit}`;
      }
    };
    
    const startDisplay = formatDateDisplay(start_date);
    const endDisplay = formatDateDisplay(end_date);
    const rangeDisplay = `${startDisplay} to ${endDisplay}`;

    context.setLabel(t('tools.periodicNotes.labels.inProgress', { 
      types: typesDisplay,
      range: rangeDisplay 
    }));

    try {
      const rangeInfo = await handlePeriodicNotesRange(
        plugin.app, 
        types,
        start_date,
        end_date
      );
      
      // Check if any types were disabled
      const requestedTypes = types;
      const enabledTypes = rangeInfo.types;
      const disabledTypes = requestedTypes.filter(type => !enabledTypes.includes(type));
      
      if (disabledTypes.length > 0) {
        const disabledTypesDisplay = translatePeriodTypes(disabledTypes);
        const disabledTypesMsg = t('tools.periodicNotes.progress.disabledTypes', { 
          types: disabledTypesDisplay 
        });
        context.progress(disabledTypesMsg);
      }
      
      if (rangeInfo.notes.length > 0) {
        // Process each individual periodic note
        let combinedContent = '';
        let foundCount = 0;
        const foundByType: Record<string, number> = {};
        
        for (const noteInfo of rangeInfo.notes) {
          if (noteInfo.found) {
            const expandedContent = await processFileLink(
              plugin.app,
              noteInfo.linkPath,
              `${noteInfo.dateStr} (${noteInfo.descriptiveLabel})`,
              new Set(), // Empty visited paths set
              true, // This is a periodic note (similar to day note)
              { formattedDate: noteInfo.formattedDate, descriptiveLabel: noteInfo.descriptiveLabel }
            );
            
            if (expandedContent) {
              combinedContent += expandedContent + '\n\n';
              foundCount++;
              
              // Track counts by type
              foundByType[noteInfo.period] = (foundByType[noteInfo.period] || 0) + 1;
              
              // Add navigation target for each found note
              context.addNavigationTarget({
                filePath: noteInfo.linkPath + '.md'
              });
            }
          } else {
            // Add individual marker for missing note using consistent XML format
            combinedContent += `<${noteInfo.period}_note_missing date="${noteInfo.dateStr}" label="${noteInfo.descriptiveLabel}" />\n\n`;
          }
        }
        
        // Generate summary by type using translations
        const summaryParts: string[] = [];
        for (const type of enabledTypes) {
          const found = foundByType[type] || 0;
          const total = rangeInfo.notes.filter(n => n.period === type).length;
          if (total > 0) {
            const translatedType = translatePeriodType(type, 'plural');
            summaryParts.push(`${found}/${total} ${translatedType}`);
          }
        }
        
        context.setLabel(t('tools.periodicNotes.labels.completed', { 
          summary: summaryParts.join(', '),
          range: rangeInfo.rangeLabel 
        }));
        
        context.progress(combinedContent.trim());
      } else {
        // No notes found
        context.setLabel(t('tools.periodicNotes.labels.noResults', { 
          types: typesDisplay,
          range: rangeInfo.rangeLabel 
        }));
        context.progress(t('tools.periodicNotes.progress.noResults', { 
          types: typesDisplay,
          range: rangeInfo.rangeLabel 
        }));
      }

    } catch (error) {
      context.setLabel(t('tools.periodicNotes.labels.failed', { 
        types: typesDisplay
      }));
      throw error;
    }
  }
}; 