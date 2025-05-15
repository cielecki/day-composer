import { App, normalizePath } from "obsidian";
import { getDailyNotesSettings } from "./getDailyNotesSettings";
import { getFormattedDate } from "./getFormattedDate";

/**
 * Gets the path to today's daily note
 * @param app Obsidian app instance
 * @returns Promise resolving to the path of today's daily note
 */

export async function getDailyNotePath(app: App, date?: Date): Promise<string> {
  const settings = await getDailyNotesSettings(app);
  const formattedDate = date ? date : getFormattedDate(settings.format);
  return normalizePath(`${settings.folder}/${formattedDate}.md`);
}
