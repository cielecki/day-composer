import { TFile } from "obsidian";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { handlePeriodicNotesRange } from '../utils/periodic-notes/periodic-note-finder';
import { expandLinks } from '../utils/links/expand-links';
import { PeriodType, FlexibleDate, OffsetUnit, translatePeriodTypes, translatePeriodType, getFolderForPeriod, isPeriodTypeEnabled } from '../utils/periodic-notes/periodic-note-calculator';

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

    // Validate that all requested period types are enabled
    const disabledTypes = types.filter(type => !isPeriodTypeEnabled(type));
    if (disabledTypes.length > 0) {
      const disabledTypesDisplay = translatePeriodTypes(disabledTypes);
      throw new Error(t('tools.periodicNotes.errors.disabledTypes', { 
        types: disabledTypesDisplay 
      }));
    }

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
      
      if (rangeInfo.notes.length > 0) {
        // Process each individual periodic note
        let combinedContent = '';
        let foundCount = 0;
        const foundByType: Record<string, number> = {};
        
        for (const noteInfo of rangeInfo.notes) {
          if (noteInfo.found) {
            // For found notes, we need to handle the content expansion ourselves to use proper periodic note tags
            // linkPath now contains the full path without .md extension
            const linkFile = plugin.app.vault.getAbstractFileByPath(noteInfo.linkPath + '.md');
            
            if (linkFile && linkFile instanceof TFile) {
              try {
                // Read the file content
                const linkedContent = await plugin.app.vault.read(linkFile);
                
                // Process frontmatter and extract just the content section
                const frontmatterMatch = linkedContent.match(
                  /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
                );
                const contentToExpand = frontmatterMatch
                  ? frontmatterMatch[2].trim()
                  : linkedContent.trim();
                
                // Recursively expand any links in the linked content
                const expandedSystemPrompt = await expandLinks(
                  plugin.app,
                  contentToExpand,
                  new Set() // Empty visited paths set
                );
                
                const expandedLinkedContent = expandedSystemPrompt.fullContent;
                const tabbedContent = expandedLinkedContent.split('\n').map((line: string) => '  ' + line).join('\n');
                
                // Build date attributes for found notes
                let dateAttributes = '';
                if (noteInfo.dateInfo?.date) {
                  dateAttributes = `date="${noteInfo.dateInfo.date}"`;
                } else if (noteInfo.dateInfo?.startDate && noteInfo.dateInfo?.endDate) {
                  dateAttributes = `start_date="${noteInfo.dateInfo.startDate}" end_date="${noteInfo.dateInfo.endDate}"`;
                }
                
                // Create the properly formatted periodic note content
                combinedContent += `<${noteInfo.period}_note ${dateAttributes} file="${linkFile.path}" label="${noteInfo.descriptiveLabel}" >\n\n${tabbedContent}\n\n</${noteInfo.period}_note>\n\n`;
                foundCount++;
                
                // Track counts by type
                foundByType[noteInfo.period] = (foundByType[noteInfo.period] || 0) + 1;
                
                // Add navigation target for each found note
                context.addNavigationTarget({
                  filePath: linkFile.path
                });
              } catch (error) {
                console.warn(`Error processing periodic note ${noteInfo.linkPath}:`, error);
                // Fall back to a simple marker if we can't process the content
                combinedContent += `<${noteInfo.period}_note_error file="${noteInfo.linkPath}.md" label="${noteInfo.descriptiveLabel}" error="${error.message}" />\n\n`;
              }
            } else {
              console.warn(`Could not resolve periodic note file: ${noteInfo.linkPath}`);
              // Add debug info to help troubleshoot
              combinedContent += `<${noteInfo.period}_note_missing_file linkPath="${noteInfo.linkPath}" label="${noteInfo.descriptiveLabel}" debug="file_not_found" />\n\n`;
            }
          } else {
            // Add individual marker for missing note using consistent XML format with same parameters as found notes
            // For missing notes, use the expected filename (dateStr) as the file reference
            const expectedFilePath = `${noteInfo.dateStr}.md`;
            
            // Build complete date attributes for missing notes
            let dateAttributes = '';
            if (noteInfo.dateInfo?.date) {
              dateAttributes = `date="${noteInfo.dateInfo.date}"`;
            } else if (noteInfo.dateInfo?.startDate && noteInfo.dateInfo?.endDate) {
              dateAttributes = `start_date="${noteInfo.dateInfo.startDate}" end_date="${noteInfo.dateInfo.endDate}"`;
            }
            
            combinedContent += `<${noteInfo.period}_note_missing ${dateAttributes} file="${expectedFilePath}" label="${noteInfo.descriptiveLabel}" />\n\n`;
          }
        }
        
        // Generate summary by type using translations
        const summaryParts: string[] = [];
        for (const type of types) {
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