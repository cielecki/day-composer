import { App, TFile, TFolder } from "obsidian";
import { resolveLinkToFile, resolveLinkToFolder } from 'src/utils/fs/link-resolver';
import { convertToValidTagName } from 'src/utils/text/xml-tag-converter';
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
		return `[Circular: ${linkText}] 🧭`;
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
	const expandedSystemPrompt = await expandLinks(
		app,
		contentToExpand,
		visitedPaths
	);
	
	const expandedLinkedContent = expandedSystemPrompt.fullContent;

	const tabbedContent = expandedLinkedContent.split('\n').map(line => '  ' + line).join('\n');

	// Format the content based on whether it's a day note or regular link
	if (isDayNote && dayNoteInfo) {
		return `<daily_note date="${dayNoteInfo.formattedDate}" file="${linkFile.path}" label="${dayNoteInfo.descriptiveLabel}" >\n\n${tabbedContent}\n\n</daily_note>\n`;
	} else {
		const tagName = convertToValidTagName(linkText);
		return `<${tagName} file="${linkFile.path}">\n\n${tabbedContent}\n\n</${tagName}>\n`;
	}
}

/**
 * Process a directory link and return its expanded content
 * @param app The Obsidian App instance
 * @param linkPath The path to the directory to process
 * @param linkText The display text for the link
 * @param visitedPaths Set of already visited paths to prevent circular references
 * @returns The expanded content or null if the directory couldn't be processed
 */
export async function processDirectoryLink(
	app: App,
	linkPath: string,
	linkText: string,
	visitedPaths: Set<string>): Promise<string | null> {
	// Try to resolve the link as a directory
	const linkFolder = resolveLinkToFolder(app, linkPath);

	// Skip if link can't be resolved
	if (!linkFolder) {
		console.warn(`Could not resolve directory link target: ${linkPath}`);
		return null;
	}

	// Skip if we've already visited this directory (circular reference)
	if (visitedPaths.has(linkFolder.path)) {
		console.warn(`Circular reference detected for directory: ${linkFolder.path}`);
		return `[Circular: ${linkText}] 🧭`;
	}

	// Track this directory path as visited
	visitedPaths.add(linkFolder.path);

	// Get all markdown files in the directory (not subdirectories)
	const markdownFiles = linkFolder.children.filter(
		(child): child is TFile => child instanceof TFile && child.extension === 'md'
	);

	// Sort files alphabetically for consistent output
	markdownFiles.sort((a, b) => a.name.localeCompare(b.name));

	const processedContent: string[] = [];

	// Process each markdown file in the directory
	for (const file of markdownFiles) {
		try {
			const expandedContent = await processFileLink(
				app,
				file.path,
				file.basename,
				visitedPaths,
				false // Not a day note
			);
			
			if (expandedContent) {
				processedContent.push(expandedContent);
			}
		} catch (error) {
			console.warn(`Error processing file ${file.path} in directory ${linkFolder.path}:`, error);
			processedContent.push(`<${convertToValidTagName(file.basename)} file="${file.path}">\n\n  [Error processing file: ${error.message}]\n\n</${convertToValidTagName(file.basename)}>\n`);
		}
	}

	// If no content was processed, indicate empty directory
	if (processedContent.length === 0) {
		// Remove from visited paths since we didn't actually process anything
		visitedPaths.delete(linkFolder.path);
		return `[No markdown files found in directory: ${linkFolder.path}]\n`;
	}

	// Return all processed content without outer wrapper
	return processedContent.join('\n');
}
