import { App, Notice } from "obsidian";
import { removeTopLevelHtmlComments } from 'src/utils/text/html-comment-remover';
import { 
	handleCurrentDateTimeLink, 
	handleCurrentlyOpenFileLink, 
	handleCurrentlySelectedTextLink,
	handleCurrentChatLink, 
	handleDayNoteLink,
	handleDayNoteRangeLink
} from './special-link-handlers';
import { processFileLink } from "./process-file-link";
import { resolveLinkToFile } from 'src/utils/fs/link-resolver';
import { t } from 'src/i18n';

/**
 * Recursively expands [[wikilinks]] in content
 * Handles circular references by tracking visited paths
 * @param app The Obsidian App instance
 * @param content The text content to expand links in
 * @param visitedPaths Set of already visited paths to prevent circular references
 * @returns Content with expanded links
 */
export async function expandLinks(
	app: App,
	content: string,
	visitedPaths: Set<string> = new Set(),
): Promise<string> {
	// Find all [[wikilinks]] followed by compass or magnifying glass emoji in the content
	const wikiLinkRegex = /\[\[([^\]]+?)\]\]\s*[🧭🔎]/g;
	let match;
	let result = content;

	// Collect matches
	const matches: Array<RegExpExecArray> = [];

	while ((match = wikiLinkRegex.exec(content)) !== null) {
		matches.push(match);
	}

	// Process all matches from last to first to avoid position shifting issues
	for (let i = matches.length - 1; i >= 0; i--) {
		const match = matches[i];
		let dayNoteMatch: RegExpMatchArray | null = null;

		// Extract the link target (remove the emoji from the match)
		let linkText = match[1];
		let linkPath = linkText;

		// Handle aliased links [[target|alias]]
		if (linkText.includes("|")) {
			[linkPath, linkText] = linkText.split("|", 2);
		}

		// Handle ln-day-note-(start:end) format for daily note ranges
		const dayNoteRangeMatch = linkPath.match(/^ln-day-note-\(([+-]?\d+):([+-]?\d+)\)$/);
		if (dayNoteRangeMatch) {
			const startOffset = parseInt(dayNoteRangeMatch[1]);
			const endOffset = parseInt(dayNoteRangeMatch[2]);
			const rangeInfo = handleDayNoteRangeLink(app, startOffset, endOffset);
			
			if (rangeInfo.notes.length > 0) {
				// Process each individual daily note in the range
				let combinedContent = '';
				
				for (const noteInfo of rangeInfo.notes) {
					if (noteInfo.found) {
						const expandedContent = await processFileLink(
							app,
							noteInfo.linkPath,
							`${noteInfo.dateStr} (${noteInfo.descriptiveLabel})`,
							visitedPaths,
							true,
							{ formattedDate: noteInfo.formattedDate, descriptiveLabel: noteInfo.descriptiveLabel }
						);
						
						if (expandedContent) {
							combinedContent += expandedContent + '\n';
						}
					} else {
						// Add individual marker for missing note using consistent XML format
						combinedContent += `<daily_note_missing date="${noteInfo.dateStr}" label="${noteInfo.descriptiveLabel}" offset="${noteInfo.offset}" />\n\n`;
					}
				}
				
				// Replace the range link with the combined content
				result = result.replace(match[0], combinedContent.trim());
			} else {
				// No notes in range (shouldn't happen with current logic)
				console.warn(`No daily notes found for range: ${startOffset} to ${endOffset}`);
				result = result.replace(match[0], `[No daily notes found for range ${startOffset} to ${endOffset}] 🧭`);
			}
			continue;
		}

		// Handle ln-day-note-(X) format for relative date notes
		dayNoteMatch = linkPath.match(/^ln-day-note-\(([+-]?\d+)\)$/);
		if (dayNoteMatch) {
			const daysOffset = parseInt(dayNoteMatch[1]);
			const dayNoteInfo = handleDayNoteLink(app, daysOffset);
			
			if (dayNoteInfo && dayNoteInfo.found) {
				const expandedContent = await processFileLink(
					app,
					dayNoteInfo.linkPath,
					`${dayNoteInfo.dateStr} (${dayNoteInfo.descriptiveLabel})`,
					visitedPaths,
					true,
					{ formattedDate: dayNoteInfo.formattedDate, descriptiveLabel: dayNoteInfo.descriptiveLabel }
				);
				
				if (expandedContent) {
					result = result.replace(match[0], expandedContent);
				} else {
					result = result.replace(match[0], `<daily_note_missing date="${dayNoteInfo.dateStr}" label="${dayNoteInfo.descriptiveLabel}" offset="${dayNoteInfo.offset}" />`);
				}
			} else {
				// No matching file found, skip this link
				const dateStr = dayNoteInfo?.dateStr || "unknown date";
				const descriptiveLabel = dayNoteInfo?.descriptiveLabel || "unknown";
				const offset = dayNoteInfo?.offset || 0;
				console.warn(`No daily note found for date: ${dateStr} (${offset} days offset)`);
				result = result.replace(match[0], `<daily_note_missing date="${dateStr}" label="${descriptiveLabel}" offset="${offset}" />`);
			}
			continue;
		}

		// Handle ln-current-date-and-time format
		if (linkPath === 'ln-current-date-and-time') {
			result = result.replace(match[0], handleCurrentDateTimeLink());
			continue;
		}

		// Handle ln-currently-open-file format
		if (linkPath === 'ln-currently-open-file') {
			const fileContent = await handleCurrentlyOpenFileLink(app);
			result = result.replace(match[0], fileContent);
			continue;
		}

		// Handle ln-currently-selected-text format
		if (linkPath === 'ln-currently-selected-text') {
			const selectedTextContent = handleCurrentlySelectedTextLink(app);
			result = result.replace(match[0], selectedTextContent);
			continue;
		}

		// Handle ln-current-chat format
		if (linkPath === 'ln-current-chat') {
			const chatContent = handleCurrentChatLink(app);
			result = result.replace(match[0], chatContent);
			continue;
		}

		// Handle regular file links using the common processing function
		const expandedContent = await processFileLink(app, linkPath, linkText, visitedPaths);
		if (expandedContent) {
			result = result.replace(match[0], expandedContent);
		} else {
			// Check if the link could be resolved at all
			const linkFile = resolveLinkToFile(app, linkPath);
			if (!linkFile) {
				// Link cannot be resolved - notify user and throw error
				throw new Error(t('errors.linkExpansion.couldNotResolve', { linkPath }));
			}
			// If we get here, the file exists but couldn't be processed (e.g., non-markdown file)
			// Keep the original link in this case
		}
	}

	// Remove top-level HTML comments before returning
	result = removeTopLevelHtmlComments(result);

	return result;
} 