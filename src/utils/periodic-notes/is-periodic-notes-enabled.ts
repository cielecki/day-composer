import { 
  appHasDailyNotesPluginLoaded,
  appHasWeeklyNotesPluginLoaded,
  appHasMonthlyNotesPluginLoaded,
  appHasQuarterlyNotesPluginLoaded,
  appHasYearlyNotesPluginLoaded
} from "obsidian-daily-notes-interface";

/**
 * Gets the status of all periodic notes plugins using the official interface
 * @returns object with plugin availability status
 */
export function getPeriodicNotesPluginStatus(): {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  quarterly: boolean;
  yearly: boolean;
} {
  return {
    daily: appHasDailyNotesPluginLoaded(),
    weekly: appHasWeeklyNotesPluginLoaded(),
    monthly: appHasMonthlyNotesPluginLoaded(),
    quarterly: appHasQuarterlyNotesPluginLoaded(),
    yearly: appHasYearlyNotesPluginLoaded()
  };
}

/**
 * Checks if any periodic notes functionality is available
 * @returns boolean indicating if any periodic notes are enabled
 */
export function hasAnyPeriodicNotesEnabled(): boolean {
  const status = getPeriodicNotesPluginStatus();
  return status.daily || status.weekly || status.monthly || status.quarterly || status.yearly;
} 