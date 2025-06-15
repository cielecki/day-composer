import { App, TFile, normalizePath } from "obsidian";
import { getPeriodicNotesSettings } from './get-periodic-notes-settings';
import { findDailyNotesByDate } from '../daily-notes/daily-note-finder';
import {
  PeriodType,
  FlexibleDate,
  PeriodicNoteInfo,
  PeriodicNotesRangeInfo,
  parseFlexibleDate,
  findPeriodsInRange,
  generateDescriptiveLabel,
  generateRangeLabel,
  getDateFormatForPeriod,
  getFolderForPeriod,
  isPeriodTypeEnabled
} from './periodic-note-calculator';
import moment from 'moment';

/**
 * Find periodic notes by searching for files matching the period's date format
 * @param app The Obsidian App instance
 * @param periodType The type of period
 * @param targetDate The target date to search for
 * @param settings The periodic notes settings
 * @returns Array of matching TFile objects
 */
export function findPeriodicNotesByDate(
  app: App,
  periodType: PeriodType,
  targetDate: Date,
  settings: Awaited<ReturnType<typeof getPeriodicNotesSettings>>
): TFile[] {
  const format = getDateFormatForPeriod(periodType, settings);
  const folder = getFolderForPeriod(periodType, settings);
  
  // Format the target date according to the period's format
  const formattedDate = moment(targetDate).format(format);
  
  return app.vault
    .getFiles()
    .filter((file) => {
      // Check if file is in the correct folder (if specified)
      if (folder) {
        const normalizedFolder = normalizePath(folder);
        if (!file.path.startsWith(normalizedFolder)) {
          return false;
        }
      }
      
      // Check if filename matches the formatted date pattern
      const filename = file.basename;
      return filename === formattedDate && file.path.endsWith(".md");
    });
}

/**
 * Create a periodic note info object for a specific period and date
 * @param app The Obsidian App instance
 * @param periodType The type of period
 * @param targetDate The target date for the period
 * @param settings The periodic notes settings
 * @param referenceDate The reference date for descriptive labels
 * @returns PeriodicNoteInfo object
 */
async function createPeriodicNoteInfo(
  app: App,
  periodType: PeriodType,
  targetDate: Date,
  settings: Awaited<ReturnType<typeof getPeriodicNotesSettings>>,
  referenceDate?: Date
): Promise<PeriodicNoteInfo> {
  const format = getDateFormatForPeriod(periodType, settings);
  
  // Generate date information for AI based on period type
  const momentDate = moment(targetDate);
  let dateInfo: { date?: string; startDate?: string; endDate?: string } = {};
  
  switch (periodType) {
    case 'daily':
      // Day of the week in user's language
      dateInfo.date = momentDate.format('dddd');
      break;
    case 'weekly':
      // Start and end date of the week (using ISO week - Monday to Sunday)
      const weekStart = momentDate.clone().startOf('isoWeek');
      const weekEnd = momentDate.clone().endOf('isoWeek');
      dateInfo.startDate = weekStart.format('YYYY-MM-DD');
      dateInfo.endDate = weekEnd.format('YYYY-MM-DD');
      break;
    case 'quarterly':
      // Start and end date of the quarter
      const quarterStart = momentDate.clone().startOf('quarter');
      const quarterEnd = momentDate.clone().endOf('quarter');
      dateInfo.startDate = quarterStart.format('YYYY-MM-DD');
      dateInfo.endDate = quarterEnd.format('YYYY-MM-DD');
      break;
    case 'monthly':
      // Start and end date of the month
      const monthStart = momentDate.clone().startOf('month');
      const monthEnd = momentDate.clone().endOf('month');
      dateInfo.startDate = monthStart.format('YYYY-MM-DD');
      dateInfo.endDate = monthEnd.format('YYYY-MM-DD');
      break;
    case 'yearly':
      // For yearly notes, the filename (e.g., "2025.md") is sufficient - no additional date attributes needed
      break;
    default:
      break;
  }
  
  // Generate descriptive label
  const descriptiveLabel = generateDescriptiveLabel(periodType, targetDate, referenceDate);
  
  // Find matching files - use our improved daily note finder for daily notes
  let matchingFiles: TFile[];
  if (periodType === 'daily') {
    // Use our improved daily note finder that respects Daily Notes settings
    const dateStrForDailyNotes = moment(targetDate).format('YYYY-MM-DD');
    matchingFiles = await findDailyNotesByDate(app, dateStrForDailyNotes);
  } else {
    // Use the standard periodic notes finder for other types
    matchingFiles = findPeriodicNotesByDate(app, periodType, targetDate, settings);
  }
  
  if (matchingFiles.length >= 1) {
    // Use the first matching file
    const linkPath = matchingFiles[0].path.replace(/\.md$/, ''); // Remove .md extension for link path
    
    return {
      dateStr: matchingFiles[0].basename, // Use actual filename as date
      formattedDate: '', // Will be replaced with dateInfo in the tool
      descriptiveLabel,
      linkPath,
      found: true,
      period: periodType,
      targetDate,
      dateInfo // Add the new date information
    };
  } else {
    // No matching file found
    const expectedFormat = moment(targetDate).format(format);
    return {
      dateStr: expectedFormat, // Use expected filename format
      formattedDate: '', // Will be replaced with dateInfo in the tool
      descriptiveLabel,
      linkPath: "",
      found: false,
      period: periodType,
      targetDate,
      dateInfo // Add the new date information
    };
  }
}

/**
 * Handle periodic notes for multiple types and flexible date range
 * @param app The Obsidian App instance
 * @param types Array of period types to include
 * @param startDate Start date (flexible format)
 * @param endDate End date (flexible format)
 * @param referenceDate The reference date for offset calculations (defaults to today)
 * @returns Information about the periodic notes range
 */
export async function handlePeriodicNotesRange(
  app: App,
  types: PeriodType[],
  startDate: FlexibleDate,
  endDate: FlexibleDate,
  referenceDate?: Date
): Promise<PeriodicNotesRangeInfo> {
  // Parse flexible dates into concrete dates
  const refDate = referenceDate || new Date();
  const parsedStartDate = parseFlexibleDate(startDate, refDate);
  const parsedEndDate = parseFlexibleDate(endDate, refDate);
  
  // Ensure start is before end
  const actualStart = parsedStartDate <= parsedEndDate ? parsedStartDate : parsedEndDate;
  const actualEnd = parsedStartDate <= parsedEndDate ? parsedEndDate : parsedStartDate;
  
  // Get settings once for all period types
  const settings = await getPeriodicNotesSettings();
  
  const allNotes: PeriodicNoteInfo[] = [];
  const enabledTypes = types.filter(type => isPeriodTypeEnabled(type));
  const disabledTypes = types.filter(type => !isPeriodTypeEnabled(type));
  
  // Warn about disabled types
  if (disabledTypes.length > 0) {
    console.warn(`The following period types are not enabled: ${disabledTypes.join(', ')}`);
  }
  
  // Process each enabled period type
  for (const periodType of enabledTypes) {
    // Find all periods of this type within the date range
    const periodsInRange = findPeriodsInRange(periodType, actualStart, actualEnd);
    
    // Create note info for each period
    for (const periodDate of periodsInRange) {
      const noteInfo = await createPeriodicNoteInfo(
        app,
        periodType,
        periodDate,
        settings,
        refDate
      );
      allNotes.push(noteInfo);
    }
  }
  
  // Sort notes by date and type
  allNotes.sort((a, b) => {
    const dateCompare = a.targetDate.getTime() - b.targetDate.getTime();
    if (dateCompare !== 0) return dateCompare;
    
    // If dates are same, sort by period type priority
    const typePriority = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
    return typePriority.indexOf(a.period) - typePriority.indexOf(b.period);
  });
  
  // Generate range label
  const rangeLabel = generateRangeLabel(actualStart, actualEnd, enabledTypes);
  
  return {
    notes: allNotes,
    rangeLabel,
    types: enabledTypes,
    startDate: actualStart,
    endDate: actualEnd
  };
} 