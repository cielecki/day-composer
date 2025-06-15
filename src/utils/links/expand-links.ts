import { App, Notice } from "obsidian";
import { removeTopLevelHtmlComments } from 'src/utils/text/html-comment-remover';
// Old special link handlers are no longer used - only new format tools are supported
import { processFileLink, processDirectoryLink } from "./process-file-link";
import { resolveLinkToFile } from 'src/utils/fs/link-resolver';
import { t } from 'src/i18n';
import { parseToolCall } from '../tools/tool-call-parser';
import { getObsidianTools } from '../../obsidian-tools';

/**
 * Interface for the three-part system prompt based on stability
 */
export interface SystemPromptParts {
	/** Static content until first expansion or tool call */
	staticSection: string;
	/** Semi-dynamic content with links until first dynamic tool call */
	semiDynamicSection: string;
	/** Dynamic content with tool calls and runtime data */
	dynamicSection: string;
	/** Full combined content of all sections */
	fullContent: string;
}

/**
 * Recursively expands [[wikilinks]] in content and returns three sections based on stability
 * Handles circular references by tracking visited paths
 * @param app The Obsidian App instance
 * @param content The text content to expand links in
 * @param visitedPaths Set of already visited paths to prevent circular references
 * @returns Object with three sections: static, semi-dynamic, and dynamic
 */
export async function expandLinks(
	app: App,
	content: string,
	visitedPaths: Set<string> = new Set(),
): Promise<SystemPromptParts> {
	// Find breakpoints in the original content
	const breakpoints = findContentBreakpoints(content);
	
	// Split content into three sections based on breakpoints
	const staticContent = content.slice(0, breakpoints.firstExpansion);
	const semiDynamicContent = content.slice(breakpoints.firstExpansion, breakpoints.firstToolCall);
	const dynamicContent = content.slice(breakpoints.firstToolCall);
	
	// Process each section
	let staticResult = staticContent;
	let semiDynamicResult = await processContentSection(app, semiDynamicContent, visitedPaths);
	let dynamicResult = await processContentSection(app, dynamicContent, visitedPaths);
	
	// Remove top-level HTML comments from all sections
	staticResult = removeTopLevelHtmlComments(staticResult);
	semiDynamicResult = removeTopLevelHtmlComments(semiDynamicResult);
	dynamicResult = removeTopLevelHtmlComments(dynamicResult);

	return {
		staticSection: staticResult,
		semiDynamicSection: semiDynamicResult,
		dynamicSection: dynamicResult,
		fullContent: staticResult + semiDynamicResult + dynamicResult
	};
}

/**
 * Find breakpoints in content to split into three sections
 */
function findContentBreakpoints(content: string): { firstExpansion: number; firstToolCall: number } {
	// Find first `🧭 expand` or any `🧭 tool_name()` pattern
	const expandRegex = /`🧭\s+expand`\s+\[\[([^\]]+)\]\]/g;
	const toolCallRegex = /`🧭\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)`/g;
	const wikiLinkCompassRegex = /\[\[([^\]]+?)\]\]\s*🧭/g;
	
	let firstExpansion = content.length; // Default to end of content
	let firstToolCall = content.length; // Default to end of content
	
	// Check for expand patterns
	let match = expandRegex.exec(content);
	if (match && match.index < firstExpansion) {
		firstExpansion = match.index;
	}
	
	// Check for old-style wikilink + compass patterns
	wikiLinkCompassRegex.lastIndex = 0;
	match = wikiLinkCompassRegex.exec(content);
	if (match && match.index < firstExpansion) {
		firstExpansion = match.index;
	}
	
	// Check for tool calls (these are considered dynamic)
	toolCallRegex.lastIndex = 0;
	match = toolCallRegex.exec(content);
	while (match) {
		// Skip expand calls as they're not dynamic tool calls
		if (!match[0].includes('expand')) {
			if (match.index < firstToolCall) {
				firstToolCall = match.index;
			}
			break;
		}
		match = toolCallRegex.exec(content);
	}
	
	// Ensure firstExpansion <= firstToolCall
	if (firstExpansion > firstToolCall) {
		firstExpansion = firstToolCall;
	}
	
	return { firstExpansion, firstToolCall };
}

/**
 * Process a section of content with link expansion and tool calls
 */
async function processContentSection(app: App, content: string, visitedPaths: Set<string>): Promise<string> {
	let result = content;

	// Process new format tool calls: `🧭 tool_name(params)` and `🧭 expand` [[link]]
	result = await processNewFormatCalls(app, result, visitedPaths);

	// Process regular [[wikilinks]] followed by compass emoji (non-special links only)
	const wikiLinkRegex = /\[\[([^\]]+?)\]\]\s*🧭/gu;
	let match;

	// Collect matches
	const matches: Array<RegExpExecArray> = [];

	while ((match = wikiLinkRegex.exec(content)) !== null) {
		matches.push(match);
	}

	// Process all matches from last to first to avoid position shifting issues
	for (let i = matches.length - 1; i >= 0; i--) {
		const match = matches[i];

		// Extract the link target (remove the emoji from the match)
		let linkText = match[1];
		let linkPath = linkText;

		// Handle aliased links [[target|alias]]
		if (linkText.includes("|")) {
			[linkPath, linkText] = linkText.split("|", 2);
		}

		// Handle regular file/directory links using the common processing functions
		let expandedContent = await processFileLink(app, linkPath, linkText, visitedPaths);
		
		// If file processing failed, try directory processing
		if (!expandedContent) {
			expandedContent = await processDirectoryLink(app, linkPath, linkText, visitedPaths);
		}
		
		if (expandedContent) {
			result = result.replace(match[0], expandedContent);
		} else {
			// Check if the link could be resolved at all
			const linkFile = resolveLinkToFile(app, linkPath);
			if (!linkFile) {
				// Link cannot be resolved - notify user and throw error
				throw new Error(t('errors.linkExpansion.couldNotResolve', { linkPath: linkPath }));
			}
			// If we get here, the file exists but couldn't be processed (e.g., non-markdown file)
			// Keep the original link in this case
		}
	}

	// Remove top-level HTML comments before returning
	result = removeTopLevelHtmlComments(result);

	return result;
}

/**
 * Process new format tool calls: `🧭 tool_name(params)` and `🧭 expand` [[link]]
 * Only executes tools that have sideEffects: false (safe for link expansion)
 */
async function processNewFormatCalls(app: App, content: string, visitedPaths: Set<string>): Promise<string> {
	let result = content;

	// First, handle `🧭 expand` [[link]] format
	const expandRegex = /`🧭\s+expand`\s+\[\[([^\]]+)\]\]/gu;
	let expandMatch;
	const expandMatches: Array<RegExpExecArray> = [];
	
	while ((expandMatch = expandRegex.exec(content)) !== null) {
		expandMatches.push(expandMatch);
	}
	
	// Process expand matches from last to first
	for (let i = expandMatches.length - 1; i >= 0; i--) {
		const match = expandMatches[i];
		const linkTarget = match[1];
		
		try {
			// First, try to process as a file
			let expandedContent = await processFileLink(app, linkTarget, linkTarget, visitedPaths);
			
			// If file processing failed, try to process as a directory
			if (!expandedContent) {
				expandedContent = await processDirectoryLink(app, linkTarget, linkTarget, visitedPaths);
			}
			
			if (expandedContent) {
				result = result.replace(match[0], expandedContent);
			} else {
				result = result.replace(match[0], `[Could not expand: ${linkTarget}]`);
			}
		} catch (error) {
			console.error(`Error expanding ${linkTarget}:`, error);
			result = result.replace(match[0], `[Error expanding ${linkTarget}: ${error.message}]`);
		}
	}

	// Second, handle `🧭 tool_name(params)` format
	const toolCallRegex = /`🧭\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)`/gu;
	let toolMatch;
	const toolMatches: Array<RegExpExecArray> = [];
	
	while ((toolMatch = toolCallRegex.exec(result)) !== null) {
		toolMatches.push(toolMatch);
	}

	// Process tool matches from last to first
	for (let i = toolMatches.length - 1; i >= 0; i--) {
		const match = toolMatches[i];
		const fullMatch = match[0];

		try {
			// Parse the tool call (remove backticks for parsing)
			const toolCallContent = fullMatch.slice(1, -1); // Remove backticks
			
			// First parse to get the tool name
			const initialParseResult = parseToolCall(toolCallContent);
			const { toolName } = initialParseResult;

			// Get the tool
			const obsidianTools = getObsidianTools();
			const tool = await obsidianTools.getToolByName(toolName);
			
			if (!tool) {
				console.warn(`Tool not found: ${toolName}`);
				result = result.replace(match[0], `[Tool not found: ${toolName}]`);
				continue;
			}
			
			// Re-parse with tool schema for proper parameter mapping
			const parseResult = parseToolCall(toolCallContent, tool.specification);
			const { parameters } = parseResult;

			// Check if tool is safe for link expansion (no side effects)
			if (tool.sideEffects) {
				console.warn(`Tool ${toolName} has side effects and cannot be used in link expansion`);
				result = result.replace(match[0], `[Tool ${toolName} has side effects and cannot be used in link expansion]`);
				continue;
			}

			// Execute the tool
			const progressMessages: string[] = [];
			
			const context = {
				plugin: { app }, // Minimal plugin-like object
				params: parameters,
				signal: new AbortController().signal,
				progress: (message: string) => {
					progressMessages.push(message);
				},
				addNavigationTarget: () => {
					// Navigation targets are not supported in link expansion
				},
				setLabel: () => {
					// Label updates are not supported in link expansion
				}
			};

			await tool.execute(context as any);

			// Replace with the tool output
			const toolOutput = progressMessages.join('\n');
			result = result.replace(match[0], toolOutput || `[${toolName} executed successfully]`);

		} catch (error) {
			console.error(`Error processing tool call ${fullMatch}:`, error);
			result = result.replace(match[0], `[Error processing ${fullMatch}: ${error.message}]`);
		}
	}

		return result;
} 