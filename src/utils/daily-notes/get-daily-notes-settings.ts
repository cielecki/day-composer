import { App } from "obsidian";

/**
 * Gets the daily notes settings from the vault configuration
 * @param app Obsidian app instance
 * @returns Promise resolving to the daily notes settings
 */

export async function getDailyNotesSettings(app: App): Promise<DailyNotesSettings> {
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
    console.error('Error reading daily notes config:', error);
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

