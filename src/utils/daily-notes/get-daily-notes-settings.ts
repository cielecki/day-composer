import { App } from "obsidian";
import { getDailyNoteSettings as getNativeDailyNoteSettings, appHasDailyNotesPluginLoaded } from "obsidian-daily-notes-interface";

/**
 * Gets the daily notes settings from the vault configuration
 * First tries to use Obsidian's native daily notes plugin settings,
 * then falls back to custom configuration if the plugin is not available
 * @param app Obsidian app instance
 * @returns Promise resolving to the daily notes settings
 */

export async function getDailyNotesSettings(app: App): Promise<DailyNotesSettings> {
  // First, try to use Obsidian's native daily notes plugin settings
  try {
    if (appHasDailyNotesPluginLoaded()) {
      const nativeSettings = getNativeDailyNoteSettings();
      return {
        folder: nativeSettings.folder || '',
        format: nativeSettings.format || 'YYYY-MM-DD'
      };
    }
  } catch (error) {
    console.warn('Failed to load native daily notes settings, falling back to custom implementation:', error);
  }

  // Fall back to custom implementation if native plugin is not available
  // Default settings
  let settings: DailyNotesSettings = { folder: '', format: 'YYYY-MM-DD' };

  try {
    const dailyNotesConfigPath = `${app.vault.configDir}/daily-notes.json`;
    if (await app.vault.adapter.exists(dailyNotesConfigPath)) {
      const configContent = await app.vault.adapter.read(dailyNotesConfigPath);
      const config = JSON.parse(configContent);
      settings = {
        folder: config.folder || '',
        format: config.format || 'YYYY-MM-DD'
      };
    }
  } catch (error) {
    console.error('Error reading custom daily notes config:', error);
    // Continue with default settings if we can't read the config
  }

  return settings;
}

/**
 * Utility functions for working with daily notes
 */

/**
 * Daily notes settings interface
 */

export interface DailyNotesSettings {
  folder: string;
  format: string;
}

