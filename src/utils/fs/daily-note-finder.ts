import { App, TFile } from "obsidian";
import { t } from '../../i18n';

export interface DailyNoteContent {
	date: Date;
	content: string;
	found: boolean;
	filePath: string;
}

/**
 * Find daily notes by date string
 * @param app The Obsidian App instance
 * @param dateStr The date string to search for (YYYY-MM-DD format)
 * @returns Array of matching TFile objects
 */
export function findDailyNotesByDate(app: App, dateStr: string): TFile[] {
	return app.vault
		.getFiles()
		.filter(
			(file) =>
				file.path.includes(`${dateStr}`) &&
				file.path.endsWith(".md"),
		);
} 