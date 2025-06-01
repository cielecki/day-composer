import { App, TFile } from "obsidian";
import { resolveLinkToFile } from '../fs/link-resolver';
import { removeTopLevelHtmlComments } from '../text/html-comment-remover';
import { convertToValidTagName } from '../text/xml-tag-converter';
import { 
	handleCurrentDateTimeLink, 
	handleCurrentlyOpenFileLink, 
	handleCurrentChatLink, 
	handleDayNoteLink 
} from '../links/special-link-handlers';

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
	// Find all [[wikilinks]] followed by magnifying glass emoji in the content
	const wikiLinkRegex = /\[\[([^\]]+?)\]\]\s*🔎/g;
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
		let descriptiveLabel = "";
		let formattedDate = "";

		// Extract the link target (remove the emoji from the match)
		let linkText = match[1];
		let linkPath = linkText;

		// Handle aliased links [[target|alias]]
		if (linkText.includes("|")) {
			[linkPath, linkText] = linkText.split("|", 2);
		}

		// Handle ln-day-note-(X) format for relative date notes
		dayNoteMatch = linkPath.match(/^ln-day-note-\(([+-]?\d+)\)$/);
		if (dayNoteMatch) {
			const daysOffset = parseInt(dayNoteMatch[1]);
			const dayNoteInfo = handleDayNoteLink(app, daysOffset);
			
			if (dayNoteInfo && dayNoteInfo.found) {
				linkPath = dayNoteInfo.linkPath;
				formattedDate = dayNoteInfo.formattedDate;
				descriptiveLabel = dayNoteInfo.descriptiveLabel;
				linkText = `${dayNoteInfo.dateStr} (${descriptiveLabel})`;
			} else {
				// No matching file found, skip this link
				const dateStr = dayNoteInfo?.dateStr || "unknown date";
				console.warn(`No daily note found for date: ${dateStr} (${daysOffset} days offset)`);
				result = result.replace(match[0], `[No daily note found for ${dateStr}] 🔎`);
				continue;
			}
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

		// Handle ln-current-chat format
		if (linkPath === 'ln-current-chat') {
			const chatContent = handleCurrentChatLink(app);
			result = result.replace(match[0], chatContent);
			continue;
		}

		// Try to resolve the link
		const linkFile = resolveLinkToFile(app, linkPath);

		// Skip if link can't be resolved
		if (!linkFile) {
			console.warn(`Could not resolve link target: ${linkPath}`);
			continue;
		}

		// Skip if we've already visited this file (circular reference)
		if (visitedPaths.has(linkFile.path)) {
			console.warn(
				`Circular reference detected for: ${linkFile.path}`,
			);
			result = result.replace(match[0], `[Circular: ${linkText}] 🔎`);
			continue;
		}

		// Skip if this is not a markdown file (e.g., images)
		if (linkFile.extension !== 'md') {
			// Keep the original link for non-markdown files
			console.debug(`Skipping non-markdown file: ${linkFile.path}`);
			continue;
		}

		try {
			// Read the linked file
			const linkedContent = await app.vault.read(linkFile);

			// Process frontmatter and extract just the content section
			const frontmatterMatch = linkedContent.match(
				/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,
			);
			const contentToExpand = frontmatterMatch
				? frontmatterMatch[2].trim()
				: linkedContent.trim();

			// Track this path as visited
			visitedPaths.add(linkFile.path);

			// Recursively expand any links in the linked content
			const expandedLinkedContent = await expandLinks(
				app,
				contentToExpand,
				visitedPaths,
			);

			const tabbedContent = expandedLinkedContent.split('\n').map(line => '  ' + line).join('\n');

			// Replace the wikilink with the expanded content in a special block
			if (dayNoteMatch) {
				// For ln-day-note links, use the exact same daily_note tag format as in buildContext
				result = result.replace(
					match[0],
					`<daily_note date="${formattedDate}" file="${linkFile.path}" label="${descriptiveLabel}" >\n\n${tabbedContent}\n\n</daily_note>\n`
				);
			} else {
				// For regular links, use the existing tag name format
				const tagName = convertToValidTagName(linkText);
				result = result.replace(
					match[0],
					`<${tagName} file="${linkFile.path}">\n\n${tabbedContent}\n\n</${tagName}>\n`
				);
			}
		} catch (error) {
			console.error(
				`Error expanding link to ${linkFile.path}:`,
				error,
			);
			result = result.replace(match[0], `[Error: ${linkText}] 🔎`);
		}
	}

	// Remove top-level HTML comments before returning
	result = removeTopLevelHtmlComments(result);

	return result;
} 