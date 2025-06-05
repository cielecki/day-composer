import { App, TFile, MarkdownView } from "obsidian";
import { t } from 'src/i18n';
import { convertToValidTagName } from '../text/xml-tag-converter';
import { formatConversationContent } from '../chat/conversation-formatter';
import { findDailyNotesByDate } from 'src/utils/daily-notes/daily-note-finder';

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
		// Skip if this is not a markdown file (e.g., images)
		if (file.extension !== 'md') {
			// Keep the original link for non-markdown files
			console.debug(`Skipping non-markdown file: ${file.path}`);
			return `[Non-markdown file currently open: ${file.path}] 🔎`;
		}
		
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
 * Handle ln-currently-selected-text special link
 * @param app The Obsidian App instance
 * @returns XML formatted currently selected text or status message
 */
export function handleCurrentlySelectedTextLink(app: App): string {
	try {
		// First check if there's any active file at all
		const activeFile = app.workspace.getActiveFile();
		if (!activeFile) {
			console.debug('No active file found');
			const translatedTagName = convertToValidTagName(t('text.currentlySelected'));
			return `<${translatedTagName} status="no_active_editor" />\n`;
		}

		// Find the MarkdownView that contains the active file
		// (The active view might be Life Navigator, so we need to find the markdown editor)
		let activeView: MarkdownView | null = null;
		
		// First try to get the active view if it's a MarkdownView
		const currentActiveView = app.workspace.getActiveViewOfType(MarkdownView);
		if (currentActiveView && currentActiveView.file?.path === activeFile.path) {
			activeView = currentActiveView;
		} else {
			// Look through all leaves to find the MarkdownView with the active file
			const leaves = app.workspace.getLeavesOfType('markdown');
			for (const leaf of leaves) {
				const view = leaf.view as MarkdownView;
				if (view.file?.path === activeFile.path) {
					activeView = view;
					break;
				}
			}
		}
		
		if (!activeView) {
			console.debug('No MarkdownView found for activeFile:', activeFile?.path);
			const translatedTagName = convertToValidTagName(t('text.currentlySelected'));
			return `<${translatedTagName} status="no_active_editor" />\n`;
		}

		// Make sure this is a markdown file
		if (activeFile.extension !== 'md') {
			console.debug(`Active file is not markdown: ${activeFile.path}`);
			const translatedTagName = convertToValidTagName(t('text.currentlySelected'));
			return `<${translatedTagName} file="${activeFile.path}" status="no_active_editor" />\n`;
		}

		// Get the CodeMirror 6 editor instance
		const editorView = (activeView.editor as any).cm;
		if (!editorView) {
			console.debug('Could not access CodeMirror editor for file:', activeFile.path);
			const translatedTagName = convertToValidTagName(t('text.currentlySelected'));
			return `<${translatedTagName} file="${activeFile.path}" status="no_active_editor" />\n`;
		}

		// Get the current selection
		const selection = editorView.state.selection.main;
		const from = selection.from;
		const to = selection.to;

		console.debug(`Selection range: ${from} to ${to} in file: ${activeFile.path}`);

		// Check if there's actually text selected
		if (from === to) {
			// No text selected
			const translatedTagName = convertToValidTagName(t('text.currentlySelected'));
			return `<${translatedTagName} file="${activeFile.path}" status="no_text_selected" />\n`;
		}

		// Get the selected text
		const selectedText = editorView.state.doc.sliceString(from, to);

		// Calculate line numbers for the selection
		const doc = editorView.state.doc;
		const startLine = doc.lineAt(from).number;
		const endLine = doc.lineAt(to).number;

		console.debug(`Selected text (${selectedText.length} chars) from line ${startLine} to ${endLine}`);

		// Get the translated tag name and convert it to a valid XML tag name
		const translatedTagName = convertToValidTagName(t('text.currentlySelected'));

		// Format the content with proper indentation
		const tabbedContent = selectedText.split('\n').map((line: string) => '  ' + line).join('\n');

		// Return the selected text in XML format
		return `<${translatedTagName} file="${activeFile.path}" start_line="${startLine}" end_line="${endLine}" status="selected">\n\n${tabbedContent}\n\n</${translatedTagName}>\n`;

	} catch (error) {
		console.error('Error retrieving currently selected text:', error);
		const translatedTagName = convertToValidTagName(t('text.currentlySelected'));
		return `<${translatedTagName} status="no_active_editor" />\n`;
	}
}

/**
 * Handle ln-current-chat special link
 * @param app The Obsidian App instance
 * @returns XML formatted current chat content or error message
 */
export function handleCurrentChatLink(app: App): string {
	try {
		// Import the store dynamically to avoid circular dependencies
		const { usePluginStore } = require('../../store/plugin-store');
		const store = usePluginStore.getState();
		
		// Get the current conversation messages from Zustand store
		const messages = store.chats.current.storedConversation.messages;
		
		// Check if there are any messages
		if (!messages || messages.length === 0) {
			const translatedTagName = convertToValidTagName(t('chat.current'));
			return `<${translatedTagName} status="empty">\n\n  ${t('chat.empty')}\n\n</${translatedTagName}>\n`;
		}
		
		// Format the conversation content
		const conversationContent = formatConversationContent(messages);
		
		// Get the translated tag name and convert it to a valid XML tag name
		const translatedTagName = convertToValidTagName(t('chat.current'));
		
		// Format the content with proper indentation
		const tabbedContent = conversationContent.split('\n').map((line: string) => '  ' + line).join('\n');
		
		// Return the chat content in XML format
		return `<${translatedTagName}>\n\n${tabbedContent}\n\n</${translatedTagName}>\n`;
	} catch (error) {
		console.error(`Error retrieving current chat content from store:`, error);
		const translatedTagName = convertToValidTagName(t('chat.current'));
		return `<${translatedTagName} status="error">\n\n  ${t('errors.chat.noContent')}\n\n</${translatedTagName}>\n`;
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