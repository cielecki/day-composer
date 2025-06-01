import { App, TFile } from "obsidian";
import { t } from '../../i18n';
import { convertToValidTagName } from '../text/xml-tag-converter';
import { getCurrentChatContent } from '../chat/chat-content-extractor';
import { findDailyNotesByDate } from '../fs/daily-note-finder';

declare global {
	interface Window {
		moment: any;
	}
}

/**
 * Handle ln-current-date-and-time special link
 * @returns XML formatted current date and time
 */
export function handleCurrentDateTimeLink(): string {
	const now = new Date();
	const moment = window.moment;
	moment.locale(moment.locale());
	
	// Format date and time according to the user's locale with full written format
	const formattedDate = moment(now).format('LLLL'); // Full date and time format (e.g., "Monday, March 18, 2024 2:30 PM")
	
	// Get the translated tag name and convert it to a valid XML tag name
	const translatedTagName = convertToValidTagName(t('dateTime.current'));
	
	// Return the formatted date and time in XML format using self-closing tag
	return `<${translatedTagName}>${formattedDate}</${translatedTagName}>\n`;
}

/**
 * Handle ln-currently-open-file special link
 * @param app The Obsidian App instance
 * @returns XML formatted currently open file content or error message
 */
export async function handleCurrentlyOpenFileLink(app: App): Promise<string> {
	// Get the active file using Obsidian API
	const file = app.workspace.getActiveFile();
	if (file && file instanceof TFile) {
		try {
			// Read the file content
			const fileContent = await app.vault.read(file);
			
			// Get the translated tag name and convert it to a valid XML tag name
			const translatedTagName = convertToValidTagName(t('file.currentlyOpen'));
			
			// Format the content with proper indentation
			const tabbedContent = fileContent.split('\n').map((line: string) => '  ' + line).join('\n');
			
			// Return the file content in XML format
			return `<${translatedTagName} file="${file.path}">\n\n${tabbedContent}\n\n</${translatedTagName}>\n`;
		} catch (error) {
			console.error(`Error reading currently open file: ${file.path}`, error);
			return `[Error reading currently open file] 🔎`;
		}
	} else {
		// No file is currently open
		return `[No file currently open] 🔎`;
	}
}

/**
 * Handle ln-current-chat special link
 * @param app The Obsidian App instance
 * @returns XML formatted current chat content or error message
 */
export function handleCurrentChatLink(app: App): string {
	try {
		// Get the current chat content from the LifeNavigatorView
		const chatContent = getCurrentChatContent(app);
		
		// Get the translated tag name and convert it to a valid XML tag name
		const translatedTagName = convertToValidTagName(t('chat.current'));
		
		// Format the content with proper indentation
		const tabbedContent = chatContent.split('\n').map((line: string) => '  ' + line).join('\n');
		
		// Return the chat content in XML format
		return `<${translatedTagName}>\n\n${tabbedContent}\n\n</${translatedTagName}>\n`;
	} catch (error) {
		console.error(`Error retrieving current chat content`, error);
		return `[Error retrieving chat content] 🔎`;
	}
}

export interface DayNoteInfo {
	dateStr: string;
	formattedDate: string;
	descriptiveLabel: string;
	linkPath: string;
	found: boolean;
	offset: number;
}

export interface DayNoteRangeInfo {
	notes: DayNoteInfo[];
	rangeLabel: string;
}

/**
 * Handle ln-day-note-(X) special links for relative date notes
 * @param app The Obsidian App instance
 * @param daysOffset Number of days offset from today
 * @returns Information about the day note or null if not found
 */
export function handleDayNoteLink(app: App, daysOffset: number): DayNoteInfo | null {
	// Calculate the date
	const targetDate = new Date();
	targetDate.setDate(targetDate.getDate() + daysOffset);
	
	// Format the date as YYYY-MM-DD
	const dateStr = targetDate.toISOString().split("T")[0];
	
	// Use moment for consistent date formatting
	const moment = window.moment;
	moment.locale(moment.locale());
	const formattedDate = moment(targetDate).format("YYYY-MM-DD dddd");
	
	// Calculate descriptive label (regardless of whether file exists)
	let descriptiveLabel: string;
	if (daysOffset > 0) {
		// Future dates
		if (daysOffset === 1) {
			descriptiveLabel = "tomorrow";
		} else if (daysOffset === 2) {
			descriptiveLabel = "day after tomorrow";
		} else {
			descriptiveLabel = `${daysOffset} days from now`;
		}
	} else if (daysOffset < 0) {
		// Past dates
		if (daysOffset === -1) {
			descriptiveLabel = "yesterday";
		} else if (daysOffset === -2) {
			descriptiveLabel = "day before yesterday";
		} else {
			descriptiveLabel = `${Math.abs(daysOffset)} days ago`;
		}
	} else {
		// Today
		descriptiveLabel = "today";
	}
	
	// Find a matching daily note
	const matchingFiles = findDailyNotesByDate(app, dateStr);

	if (matchingFiles.length >= 1) {
		// Use the first matching file
		const linkPath = matchingFiles[0].basename;
		
		return {
			dateStr,
			formattedDate,
			descriptiveLabel,
			linkPath,
			found: true,
			offset: daysOffset
		};
	} else {
		// No matching file found
		console.warn(`No daily note found for date: ${dateStr} (${daysOffset} days offset)`);
		return {
			dateStr,
			formattedDate,
			descriptiveLabel,  // Now includes the calculated descriptive label
			linkPath: "",
			found: false,
			offset: daysOffset
		};
	}
}

/**
 * Handle ln-day-note-(start:end) special links for daily note ranges
 * @param app The Obsidian App instance
 * @param startOffset Start day offset from today
 * @param endOffset End day offset from today
 * @returns Information about the day note range
 */
export function handleDayNoteRangeLink(app: App, startOffset: number, endOffset: number): DayNoteRangeInfo {
	// Ensure start is less than or equal to end
	if (startOffset > endOffset) {
		[startOffset, endOffset] = [endOffset, startOffset];
	}
	
	const notes: DayNoteInfo[] = [];
	
	// Process each day in the range
	for (let offset = startOffset; offset <= endOffset; offset++) {
		const noteInfo = handleDayNoteLink(app, offset);
		if (noteInfo) {
			notes.push(noteInfo);  // Include both found and not found notes
		}
	}
	
	// Create a descriptive range label
	let rangeLabel: string;
	if (startOffset === endOffset) {
		// Single day
		rangeLabel = notes[0]?.descriptiveLabel || "unknown date";
	} else {
		// Range of days
		const startDate = new Date();
		startDate.setDate(startDate.getDate() + startOffset);
		
		const endDate = new Date();
		endDate.setDate(endDate.getDate() + endOffset);
		
		const moment = window.moment;
		moment.locale(moment.locale());
		
		const startFormatted = moment(startDate).format("MMM D");
		const endFormatted = moment(endDate).format("MMM D, YYYY");
		
		rangeLabel = `${startFormatted} to ${endFormatted}`;
	}
	
	return {
		notes,
		rangeLabel
	};
} 