import { 
  getDailyNoteSettings,
  getWeeklyNoteSettings,
  getMonthlyNoteSettings,
  getQuarterlyNoteSettings,
  getYearlyNoteSettings,
  appHasDailyNotesPluginLoaded,
  appHasWeeklyNotesPluginLoaded,
  appHasMonthlyNotesPluginLoaded,
  appHasQuarterlyNotesPluginLoaded,
  appHasYearlyNotesPluginLoaded,
  IPeriodicNoteSettings
} from "obsidian-daily-notes-interface";

export interface PeriodicNoteSettings {
  enabled: boolean;
  folder: string;
  format: string;
  template?: string;
}

export interface AllPeriodicNotesSettings {
  daily: PeriodicNoteSettings;
  weekly: PeriodicNoteSettings;
  monthly: PeriodicNoteSettings;
  quarterly: PeriodicNoteSettings;
  yearly: PeriodicNoteSettings;
}

/**
 * Converts IPeriodicNoteSettings to our PeriodicNoteSettings format
 */
function convertSettings(settings: IPeriodicNoteSettings, enabled: boolean, defaultFormat: string): PeriodicNoteSettings {
  return {
    enabled,
    folder: settings.folder || '',
    format: settings.format || defaultFormat,
    template: settings.template
  };
}

/**
 * Gets all periodic notes settings using the obsidian-daily-notes-interface
 * @returns Promise resolving to the periodic notes settings
 */
export async function getPeriodicNotesSettings(): Promise<AllPeriodicNotesSettings> {
  try {
    // Get settings for each note type using the proper interface
    const dailySettings = getDailyNoteSettings();
    const weeklySettings = getWeeklyNoteSettings();
    const monthlySettings = getMonthlyNoteSettings();
    const quarterlySettings = getQuarterlyNoteSettings();
    const yearlySettings = getYearlyNoteSettings();

    // Check if each plugin/feature is loaded
    const dailyEnabled = appHasDailyNotesPluginLoaded();
    const weeklyEnabled = appHasWeeklyNotesPluginLoaded();
    const monthlyEnabled = appHasMonthlyNotesPluginLoaded();
    const quarterlyEnabled = appHasQuarterlyNotesPluginLoaded();
    const yearlyEnabled = appHasYearlyNotesPluginLoaded();

    return {
      daily: convertSettings(dailySettings, dailyEnabled, 'YYYY-MM-DD'),
      weekly: convertSettings(weeklySettings, weeklyEnabled, 'gggg-[W]ww'),
      monthly: convertSettings(monthlySettings, monthlyEnabled, 'YYYY-MM'),
      quarterly: convertSettings(quarterlySettings, quarterlyEnabled, 'YYYY-[Q]Q'),
      yearly: convertSettings(yearlySettings, yearlyEnabled, 'YYYY')
    };

  } catch (error) {
    console.error('Error reading periodic notes settings:', error);
    
    // Return default settings if there's an error
    return {
      daily: { enabled: false, folder: '', format: 'YYYY-MM-DD' },
      weekly: { enabled: false, folder: '', format: 'gggg-[W]ww' },
      monthly: { enabled: false, folder: '', format: 'YYYY-MM' },
      quarterly: { enabled: false, folder: '', format: 'YYYY-[Q]Q' },
      yearly: { enabled: false, folder: '', format: 'YYYY' }
    };
  }
} 