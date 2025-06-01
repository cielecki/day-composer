import { App } from "obsidian";
import { resolveLinkToFile } from "../fs/link-resolver";
import { convertToValidTagName } from "../text/xml-tag-converter";
import { expandLinks } from "./expand-links";

/**
 * Process a single file link and return its expanded content
 * @param app The Obsidian App instance
 * @param linkPath The path to the file to process
 * @param linkText The display text for the link
 * @param visitedPaths Set of already visited paths to prevent circular references
 * @param isDayNote Whether this is a day note (for special formatting)
 * @param dayNoteInfo Optional day note information for special formatting
 * @returns The expanded content or null if the file couldn't be processed
 */
export async function processFileLink(
	app: App,
	linkPath: string,
	linkText: string,
	visitedPaths: Set<string>,
	isDayNote: boolean = false,
	dayNoteInfo?: { formattedDate: string; descriptiveLabel: string; }): Promise<string | null> {
	// Try to resolve the link
	const linkFile = resolveLinkToFile(app, linkPath);

	// Skip if link can't be resolved
	if (!linkFile) {
		console.warn(`Could not resolve link target: ${linkPath}`);
		return null;
	}

	// Skip if we've already visited this file (circular reference)
	if (visitedPaths.has(linkFile.path)) {
		console.warn(`Circular reference detected for: ${linkFile.path}`);
		return `[Circular: ${linkText}] 🔎`;
	}

	// Skip if this is not a markdown file (e.g., images)
	if (linkFile.extension !== 'md') {
		// Keep the original link for non-markdown files
		console.debug(`Skipping non-markdown file: ${linkFile.path}`);
		return null;
	}

	// Read the linked file
	const linkedContent = await app.vault.read(linkFile);

	// Process frontmatter and extract just the content section
	const frontmatterMatch = linkedContent.match(
		/^---\n([\s\S]*?)\n---\n([\s\S]*)$/
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
		visitedPaths
	);

	const tabbedContent = expandedLinkedContent.split('\n').map(line => '  ' + line).join('\n');

	// Format the content based on whether it's a day note or regular link
	if (isDayNote && dayNoteInfo) {
		return `<daily_note date="${dayNoteInfo.formattedDate}" file="${linkFile.path}" label="${dayNoteInfo.descriptiveLabel}" >\n\n${tabbedContent}\n\n</daily_note>\n`;
	} else {
		const tagName = convertToValidTagName(linkText);
		return `<${tagName} file="${linkFile.path}">\n\n${tabbedContent}\n\n</${tagName}>\n`;
	}
}
