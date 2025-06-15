import { App } from "obsidian";
import { getPeriodicNotesSettings } from './get-periodic-notes-settings';
import { getPeriodicNotesPluginStatus } from './is-periodic-notes-enabled';
import { t } from 'src/i18n';
import moment from 'moment';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type OffsetUnit = 'days' | 'months' | 'years';

export interface OffsetDate {
  offset: number;
  unit: OffsetUnit;
}

export type FlexibleDate = string | OffsetDate; // ISO date string or offset object

export interface PeriodicNoteInfo {
  dateStr: string;
  formattedDate: string;
  descriptiveLabel: string;
  linkPath: string;
  found: boolean;
  period: PeriodType;
  targetDate: Date;
}

export interface PeriodicNotesRangeInfo {
  notes: PeriodicNoteInfo[];
  rangeLabel: string;
  types: PeriodType[];
  startDate: Date;
  endDate: Date;
}

/**
 * Parse a flexible date specification into a concrete Date object
 * @param flexibleDate Either an ISO date string or an offset object
 * @param referenceDate The reference date for offset calculations (defaults to today)
 * @returns The parsed Date object
 */
export function parseFlexibleDate(
  flexibleDate: FlexibleDate,
  referenceDate?: Date
): Date {
  if (typeof flexibleDate === 'string') {
    // Absolute date string
    const date = new Date(flexibleDate);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${flexibleDate}. Use YYYY-MM-DD format.`);
    }
    return date;
  } else {
    // Offset object
    const refDate = referenceDate || new Date();
    const targetMoment = moment(refDate);
    
    // Convert offset unit to moment.js unit
    let momentUnit: moment.unitOfTime.DurationConstructor;
    switch (flexibleDate.unit) {
      case 'days':
        momentUnit = 'days';
        break;
      case 'months':
        momentUnit = 'months';
        break;
      case 'years':
        momentUnit = 'years';
        break;
      default:
        throw new Error(`Unsupported offset unit: ${flexibleDate.unit}`);
    }
    
    return targetMoment.add(flexibleDate.offset, momentUnit).toDate();
  }
}

/**
 * Find all periods of a given type that fall within a date range
 * @param periodType The type of period to find
 * @param startDate The start of the date range
 * @param endDate The end of the date range
 * @returns Array of dates representing the periods within the range
 */
export function findPeriodsInRange(
  periodType: PeriodType,
  startDate: Date,
  endDate: Date
): Date[] {
  const periods: Date[] = [];
  
  // Ensure start is before end
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }
  
  let current: moment.Moment;
  const end = moment(endDate);
  
  switch (periodType) {
    case 'daily':
      current = moment(startDate).startOf('day');
      while (current.isSameOrBefore(end, 'day')) {
        periods.push(current.toDate());
        current.add(1, 'day');
      }
      break;
      
    case 'weekly':
      current = moment(startDate).startOf('week');
      while (current.isSameOrBefore(end, 'week')) {
        periods.push(current.toDate());
        current.add(1, 'week');
      }
      break;
      
    case 'monthly':
      current = moment(startDate).startOf('month');
      while (current.isSameOrBefore(end, 'month')) {
        periods.push(current.toDate());
        current.add(1, 'month');
      }
      break;
      
    case 'quarterly':
      current = moment(startDate).startOf('quarter');
      while (current.isSameOrBefore(end, 'quarter')) {
        periods.push(current.toDate());
        current.add(1, 'quarter');
      }
      break;
      
    case 'yearly':
      current = moment(startDate).startOf('year');
      while (current.isSameOrBefore(end, 'year')) {
        periods.push(current.toDate());
        current.add(1, 'year');
      }
      break;
      
    default:
      throw new Error(`Unsupported period type: ${periodType}`);
  }
  
  return periods;
}

/**
 * Generate a descriptive label for a period based on its date and type
 * @param periodType The type of period
 * @param targetDate The date of the period
 * @param referenceDate The reference date (defaults to today)
 * @returns A human-readable descriptive label
 */
export function generateDescriptiveLabel(
  periodType: PeriodType,
  targetDate: Date,
  referenceDate?: Date
): string {
  const refDate = referenceDate || new Date();
  const target = moment(targetDate);
  const ref = moment(refDate);
  
  // Calculate relative position
  let diffAmount: number;
  let isCurrent = false;
  
  switch (periodType) {
    case 'daily':
      diffAmount = target.diff(ref, 'days');
      isCurrent = target.isSame(ref, 'day');
      break;
    case 'weekly':
      diffAmount = target.diff(ref, 'weeks');
      isCurrent = target.isSame(ref, 'week');
      break;
    case 'monthly':
      diffAmount = target.diff(ref, 'months');
      isCurrent = target.isSame(ref, 'month');
      break;
    case 'quarterly':
      diffAmount = target.diff(ref, 'quarters');
      isCurrent = target.isSame(ref, 'quarter');
      break;
    case 'yearly':
      diffAmount = target.diff(ref, 'years');
      isCurrent = target.isSame(ref, 'year');
      break;
    default:
      return `${periodType} ${target.format('YYYY-MM-DD')}`;
  }
  
  if (isCurrent) {
    switch (periodType) {
      case 'daily': return 'today';
      case 'weekly': return 'this week';
      case 'monthly': return 'this month';
      case 'quarterly': return 'this quarter';
      case 'yearly': return 'this year';
    }
  }
  
  if (diffAmount > 0) {
    // Future periods
    if (diffAmount === 1) {
      switch (periodType) {
        case 'daily': return 'tomorrow';
        case 'weekly': return 'next week';
        case 'monthly': return 'next month';
        case 'quarterly': return 'next quarter';
        case 'yearly': return 'next year';
      }
    } else {
      const unit = periodType === 'daily' ? 'days' : periodType === 'weekly' ? 'weeks' : 
                   periodType === 'monthly' ? 'months' : periodType === 'quarterly' ? 'quarters' : 'years';
      return `${diffAmount} ${unit} from now`;
    }
  } else {
    // Past periods
    const absDiff = Math.abs(diffAmount);
    if (absDiff === 1) {
      switch (periodType) {
        case 'daily': return 'yesterday';
        case 'weekly': return 'last week';
        case 'monthly': return 'last month';
        case 'quarterly': return 'last quarter';
        case 'yearly': return 'last year';
      }
    } else {
      const unit = periodType === 'daily' ? 'days' : periodType === 'weekly' ? 'weeks' : 
                   periodType === 'monthly' ? 'months' : periodType === 'quarterly' ? 'quarters' : 'years';
      return `${absDiff} ${unit} ago`;
    }
  }
  
  return `${periodType} ${target.format('YYYY-MM-DD')}`;
}

/**
 * Generate a descriptive label for a date range
 * @param startDate The start date
 * @param endDate The end date  
 * @param types The period types included
 * @returns A human-readable range label
 */
export function generateRangeLabel(
  startDate: Date,
  endDate: Date,
  types: PeriodType[]
): string {
  const start = moment(startDate);
  const end = moment(endDate);
  
  // Format dates based on range duration
  const daysDiff = end.diff(start, 'days');
  
  let dateRange: string;
  if (daysDiff === 0) {
    dateRange = start.format('MMM D, YYYY');
  } else if (daysDiff <= 31) {
    dateRange = `${start.format('MMM D')} to ${end.format('MMM D, YYYY')}`;
  } else if (daysDiff <= 365) {
    dateRange = `${start.format('MMM YYYY')} to ${end.format('MMM YYYY')}`;
  } else {
    dateRange = `${start.format('YYYY')} to ${end.format('YYYY')}`;
  }
  
  const translatedTypes = translatePeriodTypes(types);
  return t('periods.rangeLabel', { types: translatedTypes, range: dateRange });
}

/**
 * Get the date format for a specific period type
 * @param periodType The type of period
 * @param settings The periodic notes settings
 * @returns The format string for the period type
 */
export function getDateFormatForPeriod(
  periodType: PeriodType,
  settings: Awaited<ReturnType<typeof getPeriodicNotesSettings>>
): string {
  switch (periodType) {
    case 'daily': return settings.daily.format;
    case 'weekly': return settings.weekly.format;
    case 'monthly': return settings.monthly.format;
    case 'quarterly': return settings.quarterly.format;
    case 'yearly': return settings.yearly.format;
    default:
      throw new Error(`Unsupported period type: ${periodType}`);
  }
}

/**
 * Get the folder for a specific period type
 * @param periodType The type of period
 * @param settings The periodic notes settings
 * @returns The folder path for the period type
 */
export function getFolderForPeriod(
  periodType: PeriodType,
  settings: Awaited<ReturnType<typeof getPeriodicNotesSettings>>
): string {
  switch (periodType) {
    case 'daily': return settings.daily.folder;
    case 'weekly': return settings.weekly.folder;
    case 'monthly': return settings.monthly.folder;
    case 'quarterly': return settings.quarterly.folder;
    case 'yearly': return settings.yearly.folder;
    default:
      throw new Error(`Unsupported period type: ${periodType}`);
  }
}

/**
 * Check if a specific period type is enabled
 * @param periodType The type of period
 * @returns Whether the period type is enabled
 */
export function isPeriodTypeEnabled(periodType: PeriodType): boolean {
  const status = getPeriodicNotesPluginStatus();
  
  switch (periodType) {
    case 'daily': return status.daily;
    case 'weekly': return status.weekly;
    case 'monthly': return status.monthly;
    case 'quarterly': return status.quarterly;
    case 'yearly': return status.yearly;
    default:
      return false;
  }
}

/**
 * Translate a period type to localized text
 * @param periodType The period type to translate
 * @param form Whether to use singular or plural form
 * @returns The translated period type
 */
export function translatePeriodType(periodType: PeriodType, form: 'singular' | 'plural' = 'singular'): string {
  switch (periodType) {
    case 'daily':
      return form === 'singular' ? t('periods.daily.singular') : t('periods.daily.plural');
    case 'weekly':
      return form === 'singular' ? t('periods.weekly.singular') : t('periods.weekly.plural');
    case 'monthly':
      return form === 'singular' ? t('periods.monthly.singular') : t('periods.monthly.plural');
    case 'quarterly':
      return form === 'singular' ? t('periods.quarterly.singular') : t('periods.quarterly.plural');
    case 'yearly':
      return form === 'singular' ? t('periods.yearly.singular') : t('periods.yearly.plural');
    default:
      return periodType;
  }
}

/**
 * Translate multiple period types to a localized comma-separated list
 * @param periodTypes Array of period types to translate
 * @returns Localized comma-separated string
 */
export function translatePeriodTypes(periodTypes: PeriodType[]): string {
  return periodTypes.map(type => translatePeriodType(type, 'plural')).join(', ');
} 