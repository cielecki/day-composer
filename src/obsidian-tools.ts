import { LifeNavigatorPlugin } from './LifeNavigatorPlugin';
import { noteCreateTool } from './tools/note-create';
import { vaultSearchTool } from './tools/vault-search';
import { noteReadTool } from './tools/note-read';
import { noteEditTool } from './tools/note-edit';
import { libraryListTool } from './tools/library-list';
import { libraryReadTool } from './tools/library-read';
import { taskCheckTool } from './tools/task-check';
import { taskAddTool } from './tools/task-add';
import { taskUncheckTool } from './tools/task-uncheck';
import { taskMoveTool } from './tools/task-move';
import { taskAbandonTool } from './tools/task-abandon';
import { taskCreateCompletedTool } from './tools/task-create-completed';

import { taskEditTool } from './tools/task-edit';
import { taskRemoveTool } from './tools/task-remove';
import { vaultFindTool } from './tools/vault-find';
import { vaultFindFilesByTagTool } from './tools/vault-find-files-by-tag';
import { modeValidatorTool } from './tools/mode-validator';
import { toolValidatorTool } from './tools/tool-validator';
import { secretSaveTool } from './tools/secret-save';
import { secretListTool } from './tools/secret-list';
import { urlDownloadTool } from './tools/url-download';
import { conversationSaveTool } from './tools/conversation-save';
import { fileMoveTool } from './tools/file-move';
import { noteDeleteTool } from './tools/note-delete';
import { toolsListTool } from './tools/tools-list';
import { currentDateTimeTool } from './tools/current-date-time';
import { dailyNoteTool } from './tools/day-note';
import { dailyNotesTool } from './tools/daily-notes';
import { currentChatTool } from './tools/current-chat';
import { currentFileAndSelectionTool } from './tools/current-file-and-selection';
import { modeDelegateTool } from './tools/mode-delegate';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { t } from "./i18n";
import { filterToolsByMode } from "./utils/tools/tool-filter";
import { LNMode } from './types/mode';
import { ToolExecutionContext } from './types/tool-execution-context';
import { validateToolParameters, formatValidationErrors } from "./utils/validation/parameter-validator";

// Import React
import React from "react";

/**
 * Represents a navigation target for tool call clicks
 */
export interface NavigationTarget {
	filePath: string;
	lineRange?: { start: number; end: number };
}

/**
 * Result returned by tool execution
 */
export interface ToolExecutionResult {
	result: string;
	navigationTargets?: NavigationTarget[];
}

/**
 * Interface for all Obsidian tools to match Anthropic's Tool format
 */
export interface ObsidianTool<TInput> {
	specification: {
		name: string;
		description: string;
		input_schema: {
			type: string;
			properties: Record<string, unknown>;
			required: string[];
		};
	};
	icon: string; // Lucide icon name
	initialLabel: string; // Initial label displayed in chat (tools can update this via setLabel)
	// Whether this tool has side effects (true) or is read-only and safe for link expansion (false)
	sideEffects: boolean;
	// Context-based execution - no return value
	execute: (context: ToolExecutionContext<TInput>) => Promise<void>;
	// Optional method to render the tool result as a React component
	// If provided, this will be used instead of the default text rendering
	renderResult?: (result: string, input: TInput) => React.ReactNode;
}

/**
 * Class that handles all Obsidian-specific tool operations
 */
export class ObsidianTools {
	private tools: ObsidianTool<Record<string, unknown>>[] = [
		noteCreateTool,
		vaultSearchTool,
		vaultFindTool,
		vaultFindFilesByTagTool,
		noteReadTool,
		noteEditTool,
		noteDeleteTool,
		libraryListTool,
		libraryReadTool,
		taskCheckTool,
		taskAddTool,
		taskUncheckTool,
		taskMoveTool,
		taskAbandonTool,
		taskCreateCompletedTool,
		taskEditTool,
		taskRemoveTool,
		modeValidatorTool,
		toolValidatorTool,
		secretSaveTool,
		secretListTool,
		urlDownloadTool,
		conversationSaveTool,
		fileMoveTool,
		toolsListTool,
		currentDateTimeTool,
		dailyNoteTool,
		dailyNotesTool,
		currentChatTool,
		currentFileAndSelectionTool,
		modeDelegateTool,
	];

	/**
	 * Ensure user-defined tools are initialized
	 */
	private async ensureUserDefinedToolsInitialized(): Promise<void> {
		// Check if user tools manager is available
		const userToolManager = LifeNavigatorPlugin.getInstance().userToolManager;
		if (userToolManager) {
			// Check if tools need to be refreshed
			const userTools = userToolManager.getTools();
			const hasUserDefinedToolsInRegistry = this.tools.some(tool => 
				tool.specification.name.startsWith('user_')
			);
			
			// If no user-defined tools in registry but tools exist in manager, refresh
			if (userTools.length > 0 && !hasUserDefinedToolsInRegistry) {
				console.debug('[USER-TOOLS] Lazy initialization: refreshing user-defined tools');
				await userToolManager.refreshTools();
			} else if (!hasUserDefinedToolsInRegistry) {
				// No tools in manager either, do initial scan
				console.debug('[USER-TOOLS] Lazy initialization: performing initial tool scan');
				await userToolManager.refreshTools();
			}
		} else {
			// User tools manager not available
			console.debug('[USER-TOOLS] User tool manager not available');
		}
	}

	/**
	 * Get all available tools in JSON schema format required by Anthropic
	 */
	async getTools(): Promise<ObsidianTool<Record<string, unknown>>[]> {
		// Ensure user-defined tools are initialized if needed
		await this.ensureUserDefinedToolsInitialized();
		return this.tools;
	}

	/**
	 * Get tools filtered by mode configuration
	 * @param mode The mode configuration to use for filtering
	 * @returns Filtered array of tools based on mode settings
	 */
	async getToolsForMode(mode: LNMode): Promise<ObsidianTool<Record<string, unknown>>[]> {
		const tools = await this.getTools();
		return filterToolsByMode(tools, mode);
	}

	/**
	 * Get tool definition by name
	 */
	async getToolByName(name: string): Promise<ObsidianTool<Record<string, unknown>> | undefined> {
		const tools = await this.getTools();
		return tools.find((tool) => tool.specification.name === name);
	}

	/**
	 * Process a tool call from Claude with context-based execution
	 */
	async processToolCall(
		toolName: string,
		toolInput: Record<string, unknown>,
		signal: AbortSignal,
		chatId: string,
		onProgress: (message: string) => void,
		onNavigationTarget: (target: NavigationTarget) => void,
		onLabelUpdate?: (label: string) => void
	): Promise<{ result: string; isError: boolean; navigationTargets: NavigationTarget[]; finalLabel?: string }> {
		console.group(`🔄 Processing Tool Call: ${toolName}`);
		console.debug("Tool Input:", toolInput);

		const navigationTargets: NavigationTarget[] = [];
		const progressMessages: string[] = [];
		let currentLabel: string | undefined;

		try {
			// Validate tool name
			if (!toolName) {
				throw new ToolExecutionError(t("errors.tools.noName"));
			}

			// Make sure toolInput is an object (not null/undefined)
			const input = toolInput || {};

			const tool = await this.getToolByName(toolName);

			if (!tool) {
				throw new ToolExecutionError(
					t("errors.tools.unknown", { tool: toolName }) || `Unknown tool "${toolName}"`,
				);
			}

			// Initialize label with tool's initial label
			currentLabel = tool.initialLabel;

			// Validate parameters against tool schema
			const validationResult = validateToolParameters(input, tool.specification.input_schema);
			if (!validationResult.isValid) {
				const errorMessage = formatValidationErrors(validationResult.errors);
				console.debug("Parameter validation failed:", validationResult.errors);
				throw new ToolExecutionError(errorMessage);
			}

			// Create the execution context
			const context: ToolExecutionContext = {
				plugin: LifeNavigatorPlugin.getInstance(),
				params: input,
				signal,
				chatId,
				progress: (message: string) => {
					progressMessages.push(message);
					onProgress(message);
				},
				addNavigationTarget: (target: NavigationTarget) => {
					navigationTargets.push(target);
					onNavigationTarget(target);
				},
				setLabel: (text: string) => {
					// Update the current label for this execution
					currentLabel = text;
					// Notify about label update
					onLabelUpdate?.(text);
				}
			};

			// Execute the tool with context
			await tool.execute(context);
			
			// Combine all progress messages into the final result
			const finalResult = progressMessages.join('\n');
			
			console.debug("Tool Execution Completed. Final Result:", finalResult);
			console.debug("Navigation Targets:", navigationTargets);
			console.debug("Final Label:", currentLabel);
			
			return { 
				result: finalResult || `${toolName} completed successfully`, 
				isError: false, 
				navigationTargets,
				finalLabel: currentLabel
			};
		} catch (error) {
			const errorMessage =
				error instanceof ToolExecutionError
					? error.message
					: t("errors.tools.execution", { 
						tool: toolName, 
						error: error.message || String(error) || "Unknown error" 
					});

			console.error(errorMessage, error);
			return { 
				result: `❌ ${errorMessage}`, 
				isError: true, 
				navigationTargets,
				finalLabel: currentLabel
			};
		} finally {
			console.groupEnd();
		}
	}
}

// Module-level instance management
let instance: ObsidianTools | null = null;

export function getObsidianTools(): ObsidianTools {
	// If instance exists, return it
	if (instance) {
		return instance;
	}

	console.debug("Initializing ObsidianTools with provided plugin");
	instance = new ObsidianTools();

	return instance;
}

export function resetObsidianTools(): void {
	console.debug("Resetting ObsidianTools instance");
	instance = null;
}
