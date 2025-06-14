import { App, normalizePath } from "obsidian";
import { getDailyNotesSettings } from "./get-daily-notes-settings";

/**
 * Converts a moment.js date format to a regular expression pattern
 * @param format The moment.js date format (e.g., "YYYY-MM-DD")
 * @returns Regular expression pattern to match the format
 */
function formatToRegex(format: string): RegExp {
  // Escape special regex characters first
  let pattern = format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Replace moment.js format tokens with regex patterns
  pattern = pattern
    .replace(/YYYY/g, '\\d{4}')  // 4-digit year
    .replace(/YY/g, '\\d{2}')    // 2-digit year
    .replace(/MM/g, '\\d{2}')    // 2-digit month
    .replace(/M/g, '\\d{1,2}')   // 1-2 digit month
    .replace(/DD/g, '\\d{2}')    // 2-digit day
    .replace(/D/g, '\\d{1,2}')   // 1-2 digit day
    .replace(/HH/g, '\\d{2}')    // 2-digit hour
    .replace(/H/g, '\\d{1,2}')   // 1-2 digit hour
    .replace(/mm/g, '\\d{2}')    // 2-digit minute
    .replace(/m/g, '\\d{1,2}')   // 1-2 digit minute
    .replace(/ss/g, '\\d{2}')    // 2-digit second
    .replace(/s/g, '\\d{1,2}');  // 1-2 digit second
  
  return new RegExp(`^${pattern}$`);
}

/**
 * Determines if a file path represents a daily note based on Obsidian's configured daily notes settings
 * @param app The Obsidian App instance
 * @param filePath The file path to check
 * @returns Promise<boolean> True if the file is a configured daily note
 */
export async function isDailyNote(app: App, filePath: string): Promise<boolean> {
  try {
    // Get the user's configured daily notes settings
    const settings = await getDailyNotesSettings(app);
    
    // Normalize the file path for comparison
    const normalizedFilePath = normalizePath(filePath);
    
    // Check if file is in the daily notes folder (if configured)
    if (settings.folder) {
      const normalizedFolder = normalizePath(settings.folder);
      if (!normalizedFilePath.startsWith(normalizedFolder)) {
        return false;
      }
    }
    
    // Extract filename without extension
    const filename = normalizedFilePath.split('/').pop()?.replace(/\.md$/, '') || '';
    
    // If there's a folder configured, remove the folder part from comparison
    const filenameToCheck = settings.folder 
      ? filename 
      : normalizedFilePath.replace(/\.md$/, '').split('/').pop() || '';
    
    // Convert the configured date format to a regex and test against filename
    const dateRegex = formatToRegex(settings.format);
    return dateRegex.test(filenameToCheck);
    
  } catch (error) {
    console.error('Error checking if file is daily note:', error);
    return false;
  }
} 