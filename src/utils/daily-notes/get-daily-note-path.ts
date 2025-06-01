import { App } from "obsidian";
import { getDailyNotesSettings } from "./get-daily-notes-settings";
import { getFormattedDate } from "../time/get-formatted-date";
import { normalizePath } from "obsidian";
import moment from "moment";

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
