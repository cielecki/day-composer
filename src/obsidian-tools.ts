import type MyPlugin from "./main";
import { createDocumentTool } from "./tools/create-document";
import { searchVaultTool } from "./tools/search-vault";
import { readDocumentTool } from "./tools/read-document";
import { appendToDocumentTool } from "./tools/append-to-document";
import { checkTodoTool } from "./tools/check-todo";
import { addTodoTool } from "./tools/add-todo";
import { uncheckTodoTool } from "./tools/uncheck-todo";
import { moveTodoTool } from "./tools/move-todo";
import { abandonTodoTool } from "./tools/abandon-todo";
import { createCompletedTodoTool } from "./tools/create-completed-todo";
import { handoverModeTool } from "./tools/handover-mode";
import { editTodoTool } from "./tools/edit-todo";
import { removeTodoTool } from "./tools/remove-todo";
import { downloadYoutubeTranscriptTool } from "./tools/download-youtube-transcript";
import { generateImageTool } from "./tools/generate-image";
import { deepResearchTool } from "./tools/deep-research";
import { listDirectoryTool } from "./tools/list-directory";
import { findFilesByTagTool } from "./tools/find-files-by-tag";
import { ToolExecutionError } from "./utils/tools/tool-execution-error";
import { t } from "./i18n";
import { filterToolsByMode } from "./utils/tool-filter";
import { LNMode } from './utils/mode/LNMode';
import { ToolExecutionContext } from './utils/chat/types';

// Import React
import React from "react";

/**
 * Represents a navigation target for tool call clicks
 */
export interface NavigationTarget {
	filePath: string;
	lineRange?: { start: number; end: number };
	description: string;
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
	getActionText: (
		input: TInput,
		hasStarted: boolean,
		hasCompleted: boolean,
		hasError: boolean,
	) => string;
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
	private plugin: MyPlugin;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private tools: ObsidianTool<any>[] = [
		createDocumentTool,
		searchVaultTool,
		listDirectoryTool,
		findFilesByTagTool,
		readDocumentTool,
		appendToDocumentTool,
		checkTodoTool,
		addTodoTool,
		uncheckTodoTool,
		moveTodoTool,
		abandonTodoTool,
		createCompletedTodoTool,
		//Disabled for now: showTodosTool,
		handoverModeTool,
		editTodoTool,
		removeTodoTool,
		downloadYoutubeTranscriptTool,
		generateImageTool,
		deepResearchTool,
	];

	constructor(plugin: MyPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get all available tools in JSON schema format required by Anthropic
	 */
	getTools(): ObsidianTool<any>[] {
		return this.tools;
	}

	/**
	 * Get tools filtered by mode configuration
	 * @param mode The mode configuration to use for filtering
	 * @returns Filtered array of tools based on mode settings
	 */
	getToolsForMode(mode: LNMode): ObsidianTool<any>[] {
		return filterToolsByMode(this.tools, mode);
	}

	/**
	 * Get tool definition by name
	 */
	getToolByName(name: string): ObsidianTool<any> | undefined {
		return this.getTools().find((tool) => tool.specification.name === name);
	}

	/**
	 * Process a tool call from Claude with context-based execution
	 */
	async processToolCall(
		toolName: string,
		toolInput: any,
		signal: AbortSignal,
		onProgress: (message: string) => void,
		onNavigationTarget: (target: NavigationTarget) => void
	): Promise<{ result: string; isError: boolean; navigationTargets: NavigationTarget[] }> {
		console.group(`🔄 Processing Tool Call: ${toolName}`);
		console.log("Tool Input:", toolInput);

		const navigationTargets: NavigationTarget[] = [];
		const progressMessages: string[] = [];

		try {
			// Validate tool name
			if (!toolName) {
				throw new ToolExecutionError(t("errors.tools.noName"));
			}

			// Make sure toolInput is an object (not null/undefined)
			const input = toolInput || {};

			const tool = this.getToolByName(toolName);

			if (!tool) {
				throw new ToolExecutionError(
					t("errors.tools.unknown", { tool: toolName }) || `Unknown tool "${toolName}"`,
				);
			}

			// Create the execution context
			const context: ToolExecutionContext = {
				plugin: this.plugin,
				params: input,
				signal,
				progress: (message: string) => {
					progressMessages.push(message);
					onProgress(message);
				},
				addNavigationTarget: (target: NavigationTarget) => {
					navigationTargets.push(target);
					onNavigationTarget(target);
				}
			};

			// Execute the tool with context
			await tool.execute(context);
			
			// Combine all progress messages into the final result
			const finalResult = progressMessages.join('\n');
			
			console.log("Tool Execution Completed. Final Result:", finalResult);
			console.log("Navigation Targets:", navigationTargets);
			
			return { 
				result: finalResult || `${toolName} completed successfully`, 
				isError: false, 
				navigationTargets 
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
			return { result: `❌ ${errorMessage}`, isError: true, navigationTargets };
		} finally {
			console.groupEnd();
		}
	}
}

// Module-level instance management
let instance: ObsidianTools | null = null;

export function getObsidianTools(plugin: MyPlugin): ObsidianTools {
	// If instance exists, return it
	if (instance) {
		return instance;
	}

	console.log("Initializing ObsidianTools with provided plugin");
	instance = new ObsidianTools(plugin);
	return instance;
}

export function resetObsidianTools(): void {
	console.log("Resetting ObsidianTools instance");
	instance = null;
}
