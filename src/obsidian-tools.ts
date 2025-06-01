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
import { ToolExecutionError } from "./utils/tools/tool-execution-error";
import { t } from "./i18n";
import { filterToolsByMode } from "./utils/tool-filter";
import { LNMode } from "./types/types";

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
		output: string,
		hasResult: boolean,
		hasError: boolean,
	) => string;
	execute: (plugin: MyPlugin, params: TInput) => Promise<string | ToolExecutionResult>;
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
	 * Process a tool call from Claude
	 */
	async processToolCall(
		toolName: string,
		toolInput: any,
	): Promise<{ result: string; isError: boolean; navigationTargets?: NavigationTarget[] }> {
		console.group(`🔄 Processing Tool Call: ${toolName}`);
		console.log("Tool Input:", toolInput);

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

			const executionResult = await tool.execute(this.plugin, input);
			
			// Handle both string and ToolExecutionResult return types
			if (typeof executionResult === 'string') {
				console.log("Tool Execution Result:", executionResult);
				return { result: executionResult, isError: false };
			} else {
				console.log("Tool Execution Result:", executionResult.result);
				console.log("Navigation Targets:", executionResult.navigationTargets);
				return { 
					result: executionResult.result, 
					isError: false, 
					navigationTargets: executionResult.navigationTargets 
				};
			}
		} catch (error) {
			const errorMessage =
				error instanceof ToolExecutionError
					? error.message
					: t("errors.tools.execution", { 
						tool: toolName, 
						error: error.message || String(error) || "Unknown error" 
					});

			console.error(errorMessage, error);
			return { result: `❌ ${errorMessage}`, isError: true };
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
