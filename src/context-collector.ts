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

		// Remove consecutive underscores
		result = result.replace(/_+/g, '_');

		// Remove leading and trailing underscores
		result = result.replace(/^_+|_+$/g, '');
		
		// Ensure the tag name starts with a valid XML NameStartChar (letter or underscore)
		if (!/^[a-z_]/.test(result)) {
			result = '_' + result;
		}

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

			// Handle ln-day-note-(X) format for relative date notes
			dayNoteMatch = linkPath.match(/^ln-day-note-\(([+-]?\d+)\)$/);
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

			// Handle ln-current-date-and-time format
			if (linkPath === 'ln-current-date-and-time') {
				const now = new Date();
				const moment = window.moment;
				moment.locale(moment.locale());
				
				// Format date and time according to the user's locale with full written format
				const formattedDate = moment(now).format('LLLL'); // Full date and time format (e.g., "Monday, March 18, 2024 2:30 PM")
				
				// Get the translated tag name and convert it to a valid XML tag name
				const translatedTagName = this.convertToValidTagName(t('dateTime.current'));
				
				// Replace the link with the formatted date and time in XML format using self-closing tag
				result = result.replace(
					match[0],
					`<${translatedTagName}>${formattedDate}</${translatedTagName}>\n`
				);
				continue;
			}

			// Handle ln-currently-open-file format
			if (linkPath === 'ln-currently-open-file') {
				// Get the active file using Obsidian API
				const file = this.app.workspace.getActiveFile();
				if (file && file instanceof TFile) {
					try {
						// Read the file content
						const fileContent = await this.app.vault.read(file);
						
						// Get the translated tag name and convert it to a valid XML tag name
						const translatedTagName = this.convertToValidTagName(t('file.currentlyOpen'));
						
						// Format the content with proper indentation
						const tabbedContent = fileContent.split('\n').map((line: string) => '  ' + line).join('\n');
						
						// Replace the link with the file content in XML format
						result = result.replace(
							match[0],
							`<${translatedTagName} file="${file.path}">\n\n${tabbedContent}\n\n</${translatedTagName}>\n`
						);
					} catch (error) {
						console.error(`Error reading currently open file: ${file.path}`, error);
						result = result.replace(match[0], `[Error reading currently open file] 🔎`);
					}
				} else {
					// No file is currently open
					result = result.replace(match[0], `[No file currently open] 🔎`);
				}
				continue;
			}

			// Handle ln-current-chat format
			if (linkPath === 'ln-current-chat') {
				// Access the chat content from the app-level view
				try {
					// Get the current chat content from the AICoachView
					const chatContent = this.getCurrentChatContent();
					
					// Get the translated tag name and convert it to a valid XML tag name
					const translatedTagName = this.convertToValidTagName(t('chat.current'));
					
					// Format the content with proper indentation
					const tabbedContent = chatContent.split('\n').map((line: string) => '  ' + line).join('\n');
					
					// Replace the link with the chat content in XML format
					result = result.replace(
						match[0],
						`<${translatedTagName}>\n\n${tabbedContent}\n\n</${translatedTagName}>\n`
					);
				} catch (error) {
					console.error(`Error retrieving current chat content`, error);
					result = result.replace(match[0], `[Error retrieving chat content] 🔎`);
				}
				continue;
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
					// For ln-day-note links, use the exact same daily_note tag format as in buildContext
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

	/**
	 * Get the current chat content from the active view
	 * @returns The formatted chat content or an error message
	 */
	private getCurrentChatContent(): string {
		try {
			// Find all AICoachView leaves in the workspace
			const aiCoachViewLeaves = this.app.workspace.getLeavesOfType("ai-coach-view");
			
			// If no leaves found, return error message
			if (!aiCoachViewLeaves || aiCoachViewLeaves.length === 0) {
				console.log("No AI Coach view leaves found");
				return t('errors.chat.noContent');
			}
			
			// Get the view instance from the first leaf
			const aiCoachViewLeaf = aiCoachViewLeaves[0];
			const view = aiCoachViewLeaf.view;
			
			// The conversation is likely stored in the AIAgentContext
			// Try to access the Life Navigator plugin (this is the proper way to access plugins)
			// @ts-ignore - Accessing plugins this way requires ignoring TypeScript
			const plugin = this.app.plugins?.plugins?.["life-navigator"];
			if (plugin) {
				console.log("Found Life Navigator plugin:", plugin);
				
				// Look for conversation in AIAgentProvider's conversationRef
				// @ts-ignore - Using internal plugin structure
				if (plugin.aiAgent && plugin.aiAgent.conversation) {
					console.log("Found conversation in plugin.aiAgent");
					return this.formatConversationContent(plugin.aiAgent.conversation);
				}
			}
			
			// Try to find the conversation via DOM inspection
			try {
				// Find the conversation container in the DOM
				const aiCoachView = this.app.workspace.containerEl.querySelector('.ai-coach-view');
				if (aiCoachView) {
					console.log("Found AI Coach view in DOM");
					
					// Debug: Log the HTML structure
					console.log("AI Coach view HTML:", aiCoachView.innerHTML);
					
					// Try different selectors for messages
					const selectors = [
						'.message', 
						'.conversation-container > div',
						'.markdown-content',
						'[class*="message"]',
						'[class*="conversation"] > div'
					];
					
					let messageElements: NodeListOf<Element> | null = null;
					let successfulSelector = '';
					
					// Try each selector until we find elements
					for (const selector of selectors) {
						const elements = aiCoachView.querySelectorAll(selector);
						console.log(`Selector "${selector}" found ${elements.length} elements`);
						
						if (elements && elements.length > 0) {
							messageElements = elements;
							successfulSelector = selector;
							break;
						}
					}
					
					if (messageElements && messageElements.length > 0) {
						console.log(`Found message elements with selector "${successfulSelector}"`);
						
						// Extract user and assistant messages
						const conversation: any[] = [];
						
						messageElements.forEach((el, index) => {
							console.log(`Message element ${index} classes:`, el.className);
							console.log(`Message element ${index} innerHTML:`, el.innerHTML);
							
							// Try to determine if this is a user or assistant message
							const isUser = 
								el.classList.contains('user') || 
								el.innerHTML.includes('User') ||
								el.textContent?.includes('👤');
							
							const isAssistant = 
								el.classList.contains('assistant') || 
								el.innerHTML.includes('Assistant') ||
								el.textContent?.includes('🤖');
							
							// If we can't determine the role, skip this element
							if (!isUser && !isAssistant) return;
							
							// Find the content - try different selectors
							const contentSelectors = ['.message-content', '.markdown-content', 'p', 'div'];
							let contentEl = null;
							
							for (const selector of contentSelectors) {
								const candidate = el.querySelector(selector);
								if (candidate && candidate.textContent) {
									contentEl = candidate;
									break;
								}
							}
							
							// If no specific content element found, use the element itself
							if (!contentEl && el.textContent) {
								contentEl = el;
							}
							
							if (contentEl) {
								const textContent = contentEl.textContent || "";
								const cleanText = textContent
									.replace(/👤\s*User:\s*/g, '')  // Remove "👤 User:" prefix
									.replace(/🤖\s*Assistant:\s*/g, '')  // Remove "🤖 Assistant:" prefix
									.trim();
								
								if (cleanText) {
									conversation.push({
										role: isUser ? "user" : "assistant",
										content: [{ type: "text", text: cleanText }]
									});
								}
							}
						});
						
						if (conversation.length > 0) {
							console.log("Successfully extracted conversation from DOM:", conversation);
							return this.formatConversationContent(conversation);
						}
					}
					
					// If we couldn't find messages but the chat is not empty
					// Return a placeholder conversation
					if (aiCoachView.textContent && !aiCoachView.textContent.includes('No chat content')) {
						console.log("Found chat content but couldn't parse messages, returning empty chat message");
						// Return a clear "chat is empty" message instead of the raw text
						return t('chat.empty');
					}
				}
			} catch (domError) {
				console.error("Error extracting conversation from DOM:", domError);
			}
			
			// Direct global window access
			try {
				// @ts-ignore - Access global objects
				if (window && window.lifeNavigator && window.lifeNavigator.aiAgent) {
					// @ts-ignore
					const conversation = window.lifeNavigator.aiAgent.conversation;
					if (Array.isArray(conversation) && conversation.length > 0) {
						console.log("Found conversation in global window.lifeNavigator");
						return this.formatConversationContent(conversation);
					}
				}
			} catch (windowError) {
				console.error("Error accessing global objects:", windowError);
			}
			
			// Cast to any to avoid TypeScript errors
			const aiCoachView = view as any;
			
			// Try direct property access as a fallback
			if (aiCoachView && typeof aiCoachView.conversation !== 'undefined') {
				const conversation = aiCoachView.conversation;
				
				if (Array.isArray(conversation) && conversation.length > 0) {
					console.log("Successfully retrieved conversation using getter");
					return this.formatConversationContent(conversation);
				}
			}
			
			// Fallback to accessing the private _conversation property directly
			if (aiCoachView && Array.isArray(aiCoachView._conversation) && aiCoachView._conversation.length > 0) {
				console.log("Successfully retrieved conversation using _conversation property");
				return this.formatConversationContent(aiCoachView._conversation);
			}
			
			console.log("No conversation found in AICoachView");
			return t('errors.chat.noContent');
		} catch (error) {
			console.error("Error getting chat content:", error);
			return t('errors.chat.noContent');
		}
	}

	/**
	 * Format the conversation into a readable string
	 * @param conversation The conversation to format
	 * @returns A formatted string representation of the conversation
	 */
	private formatConversationContent(conversation: any[]): string {
		if (!conversation || conversation.length === 0) {
			return t('errors.chat.noContent');
		}

		// Get the translated tag names and convert them to valid XML tags
		const userTagName = this.convertToValidTagName(t('chat.userMessage'));
		const assistantTagName = this.convertToValidTagName(t('chat.assistantMessage'));
		
		// Build a formatted representation of the conversation with XML tags for each message
		const conversationContent = conversation
			.map((message) => {
				// Skip tool result messages
				if (message.role === "user" && Array.isArray(message.content)) {
					const isOnlyToolResults = message.content.every(
						(item: any) =>
							typeof item === "object" &&
							item !== null &&
							"type" in item &&
							item.type === "tool_result"
					);
					if (isOnlyToolResults) {
						return null;
					}
				}
				
				// Extract text content
				let textContent = "";
				if (typeof message.content === "string") {
					textContent = message.content;
				} else if (Array.isArray(message.content)) {
					// Extract text from content blocks
					textContent = message.content
						.filter((block: any) => block.type === "text")
						.map((block: any) => block.text)
						.join("\n");
				}

				// Skip empty messages
				if (!textContent.trim()) {
					return null;
				}

				// Format with appropriate tag based on role
				const tagName = message.role === "user" ? userTagName : assistantTagName;
				
				// Indent the content for better readability
				const indentedContent = textContent
					.split('\n')
					.map(line => `    ${line}`)
					.join('\n');
				
				return `  <${tagName}>\n${indentedContent}\n  </${tagName}>`;
			})
			.filter(Boolean) // Remove null entries
			.join("\n\n");
			
		// Format the conversation as XML with proper indentation
		return conversationContent
	}
}
