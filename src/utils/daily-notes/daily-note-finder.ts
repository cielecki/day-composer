import { App, TFile, normalizePath } from "obsidian";
import { getDailyNotesSettings } from './get-daily-notes-settings';
import moment from 'moment';

export interface DailyNoteContent {
	date: Date;
	content: string;
	found: boolean;
	filePath: string;
}

/**
 * Find daily notes by date using proper Daily Notes plugin configuration
 * @param app The Obsidian App instance
 * @param dateStr The date string to search for (YYYY-MM-DD format)
 * @returns Array of matching TFile objects
 */
export async function findDailyNotesByDate(app: App, dateStr: string): Promise<TFile[]> {
	try {
		// Get the user's configured daily notes settings
		const settings = await getDailyNotesSettings(app);
		
		// Parse the date string and format it according to the user's configured format
		const targetDate = moment(dateStr, 'YYYY-MM-DD');
		if (!targetDate.isValid()) {
			console.warn(`Invalid date string: ${dateStr}`);
			return [];
		}
		
		// Format the date according to the user's configured format
		const formattedDate = targetDate.format(settings.format);
		
		// Handle formats that contain folder separators (like YYYY/MM/YYYY-MM-DD)
		const expectedPath = settings.folder ? 
			normalizePath(`${settings.folder}/${formattedDate}.md`) : 
			normalizePath(`${formattedDate}.md`);
		
		const allFiles = app.vault.getFiles();
		
		const matchingFiles = allFiles.filter((file) => {
			// For formats with folder separators, match the full path
			if (formattedDate.includes('/')) {
				return file.path === expectedPath;
			} else {
				// For simple formats, use the original logic
				// Check if file is in the correct folder (if specified)
				if (settings.folder) {
					const normalizedFolder = normalizePath(settings.folder);
					if (!file.path.startsWith(normalizedFolder)) {
						return false;
					}
				}
				
				// Check if filename matches the formatted date pattern exactly
				const filename = file.basename;
				return filename === formattedDate && file.path.endsWith(".md");
			}
		});
		
		return matchingFiles;
			
	} catch (error) {
		console.error('Error finding daily notes by date:', error);
		// Fallback to the old simple search if settings can't be loaded
		return app.vault
			.getFiles()
			.filter(
				(file) =>
					file.path.includes(`${dateStr}`) &&
					file.path.endsWith(".md"),
			);
	}
} 