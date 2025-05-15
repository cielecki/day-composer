import { App, TFile } from "obsidian";
import { t } from './i18n';

export interface DailyNoteContent {
	date: Date;
	content: string;
	found: boolean;
	filePath: string;
}

export class ContextCollector {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Get the content of a daily note for a given date
	 * @param date The date to get the note for
	 * @returns The content and status of note retrieval
	 */
	async getDailyNoteContent(date: Date): Promise<DailyNoteContent> {
		const dateStr = date.toISOString().split("T")[0];
		const matchingFiles = this.app.vault
			.getFiles()
			.filter(
				(file) =>
					file.path.includes(`${dateStr}`) &&
					file.path.endsWith(".md"),
			);

		if (matchingFiles.length == 1) {
			return {
				date,
				content: await this.app.vault.read(matchingFiles[0]),
				found: true,
				filePath: matchingFiles[0].path,
			};
		} else if (matchingFiles.length > 1) {
			console.log(`Multiple daily notes found for date: ${dateStr}`);
			throw new Error(t('errors.notes.multipleFound').replace('{{date}}', dateStr));
		} else {
			console.log(`Daily note not found for date: ${dateStr}`);
			return {
				date,
				content: t('errors.notes.noContent').replace('{{date}}', dateStr),
				found: false,
				filePath: '',
			};
		}
	}

	/**
	 * Converts a string to a valid XML tag name by replacing non-ASCII characters
	 * with their ASCII equivalents and ensuring the result is a valid XML tag name
	 * @param text The text to convert
	 * @returns A valid XML tag name
	 */
	private convertToValidTagName(text: string): string {
		// Normalize the text using NFKD form, which separates diacritics
		// Then remove all diacritics and convert to lowercase
		let result = text.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '') // Remove diacritics
			.toLowerCase();

		// Replace any remaining non-alphanumeric characters with underscores
		result = result.replace(/[^a-z0-9]/g, '_');

		// Ensure the tag name starts with a letter
		if (!/^[a-z]/.test(result)) {
			result = 'tag_' + result;
		}

		// Remove consecutive underscores
		result = result.replace(/_+/g, '_');

		// Remove leading and trailing underscores
		result = result.replace(/^_+|_+$/g, '');

		return result;
	}

	/**
	 * Recursively expands [[wikilinks]] in content
	 * Handles circular references by tracking visited paths
	 * @param content The text content to expand links in
	 * @param visitedPaths Set of already visited paths to prevent circular references
	 * @returns Content with expanded links
	 */
	async expandLinks(
		content: string,
		visitedPaths: Set<string> = new Set(),
	): Promise<string> {
		// Prevent excessive recursion


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

			// Handle day-note-(X) format for relative date notes
			dayNoteMatch = linkPath.match(/^day-note-\(([+-]?\d+)\)$/);
			if (dayNoteMatch) {
				const daysOffset = parseInt(dayNoteMatch[1]);
				// Calculate the date
				const targetDate = new Date();
				targetDate.setDate(targetDate.getDate() + daysOffset);
				
				// Format the date as YYYY-MM-DD
				const dateStr = targetDate.toISOString().split("T")[0];
				
				// Use moment for consistent date formatting as in buildContext
				const moment = window.moment;
				moment.locale(moment.locale());
				formattedDate = moment(targetDate).format("YYYY-MM-DD dddd");
				
				// Find a matching daily note
				const matchingFiles = this.app.vault
					.getFiles()
					.filter(
						(file) =>
							file.path.includes(`${dateStr}`) &&
							file.path.endsWith(".md"),
					);

				if (matchingFiles.length >= 1) {
					// Use the first matching file
					linkPath = matchingFiles[0].basename;
					
					// Calculate descriptive label that will be used both for linkText and tag
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
					
					linkText = `${dateStr} (${descriptiveLabel})`;
				} else {
					// No matching file found, skip this link
					console.warn(`No daily note found for date: ${dateStr} (${daysOffset} days offset)`);
					result = result.replace(match[0], `[No daily note found for ${dateStr}] 🔎`);
					continue;
				}
			}

			// Try to resolve the link
			const linkFile = this.getLinkpathDest(linkPath);

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
				const linkedContent = await this.app.vault.read(linkFile);

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
				const expandedLinkedContent = await this.expandLinks(
					contentToExpand,
					visitedPaths,
				);

				const tabbedContent = expandedLinkedContent.split('\n').map(line => '  ' + line).join('\n');

				// Replace the wikilink with the expanded content in a special block
				if (dayNoteMatch) {
					// For day-note links, use the exact same daily_note tag format as in buildContext
					result = result.replace(
						match[0],
						`<daily_note date="${formattedDate}" file="${linkFile.path}" label="${descriptiveLabel}" >\n\n${tabbedContent}\n\n</daily_note>\n`
					);
				} else {
					// For regular links, use the existing tag name format
					const tagName = this.convertToValidTagName(linkText);
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

		return result;
	}

	/**
	 * Helper method to resolve a link path to a file
	 * @param linkpath The link path to resolve
	 * @returns The resolved TFile or null if not found
	 */
	private getLinkpathDest(linkpath: string): TFile | null {
		// Try to resolve the link using Obsidian's API
		// @ts-ignore: Using private API
		if (this.app.metadataCache.getFirstLinkpathDest) {
			// @ts-ignore: Using private API
			return this.app.metadataCache.getFirstLinkpathDest(linkpath, "");
		}

		// Fallback: manual resolution
		return (
			this.app.vault
				.getFiles()
				.find(
					(file) =>
						file.path === linkpath || file.basename === linkpath,
				) || null
		);
	}
}
