import MyPlugin from "../main";
import { fileExists } from "./utils/fileExists";
import { getDailyNotePath } from "./utils/getDailyNotePath";
import { getFormattedDate } from "./utils/getFormattedDate";
import { getDailyNotesSettings } from "./utils/getDailyNotesSettings";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { ObsidianTool } from "../obsidian-tools";
import { Note, readNote } from "./utils/note-utils";
import { Task } from "./utils/task-utils";
import React from "react";
import { TodoDisplay, TodoItem } from "../components/TodoDisplay";
import { checkTodoTool } from "./check-todo";
import { uncheckTodoTool } from "./uncheck-todo";
import { abandonTodoTool } from "./abandon-todo";
import { t } from "../i18n";

// Mapping function to convert from parsed Task to TodoItem
const mapTaskToTodoItem = (task: Task): TodoItem => {
	return {
		description: task.description,
		status: task.status,
		emoji: task.emoji,
		notes: task.comment.split("\n"),
		timeInfo: task.timeInfo,
		target: task.target,
		source: task.source,
	};
};

const schema = {
	name: "show_todos",
	description:
		"Shows a selected few to-do items from a document or today's daily note with a visual display",
	input_schema: {
		type: "object",
		properties: {
			todos: {
				type: "array",
				description:
					"Specific todos to show (provide descriptions). If empty, will attempt to select a few relevant todos.",
				items: {
					type: "string",
				},
			},
			status: {
				type: "string",
				description:
					"Filter todos by status ('pending', 'completed', 'abandoned', 'moved', or 'all'). Default is 'pending'.",
			},
			max_items: {
				type: "number",
				description:
					"Maximum number of items to return. Default is 5. Set to 0 for unlimited.",
			},
			file_path: {
				type: "string",
				description:
					"The specific file to search for to-dos (including .md extension). If not provided, searches only in today's daily note.",
			},
			interactive: {
				type: "boolean",
				description:
					"Whether to enable interactive checkboxes. Default is true.",
			},
		},
		required: [],
	},
};

type ShowTodosToolInput = {
	todos?: string[];
	status?: string;
	max_items?: number;
	file_path?: string;
	interactive?: boolean;
};

export const showTodosTool: ObsidianTool<ShowTodosToolInput> = {
	specification: schema,
	icon: "list-checks",

	// Returns a text representation for the action
	getActionText: (
		input: ShowTodosToolInput,
		output: string,
		hasResult: boolean,
		hasError: boolean,
	) => {
		const statusFilter = input?.status || "pending";
		const maxItems = input?.max_items !== undefined ? input.max_items : 5;
		const hasSpecificTodos =
			Array.isArray(input?.todos) && input.todos.length > 0;

		const actionText = hasSpecificTodos
			? `specific todos`
			: `${maxItems || "all"} ${statusFilter} todos`;

		if (hasResult) {
			return hasError
				? `Failed to show ${actionText}`
				: `Showing ${actionText}`;
		} else {
			return `Finding ${actionText}...`;
		}
	},

	// Executes the tool functionality
	execute: async (
		plugin: MyPlugin,
		params: ShowTodosToolInput,
	): Promise<string> => {
		try {
			const {
				todos = [],
				status = "pending",
				max_items = 5,
				file_path,
				interactive = true,
			} = params;

			let document: Note;
			let filePath: string;
			let formattedDate = "";

			// If file_path is provided, search in that specific file
			if (file_path) {
				// Check if the file exists
				const exists = await fileExists(file_path, plugin.app);
				if (!exists) {
					throw new ToolExecutionError(
						t("errors.files.notFound").replace(
							"{{path}}",
							file_path,
						),
					);
				}

				// Read the note with the readNote utility
				document = await readNote({ plugin, filePath: file_path });
				filePath = file_path;
			} else {
				// No specific file was provided, so search only in today's note
				filePath = await getDailyNotePath(plugin.app);

				// Check if today's note exists
				const exists = await fileExists(filePath, plugin.app);
				if (!exists) {
					throw new ToolExecutionError(
						t("errors.files.todayNotExists"),
					);
				}

				// Read today's note
				document = await readNote({ plugin, filePath });

				// Get formatted date for display
				const settings = await getDailyNotesSettings(plugin.app);
				formattedDate = getFormattedDate(settings.format);
			}

			// Extract all tasks
			const allTasks: Task[] = [];

			// Collect tasks from the document
			for (const node of document.content) {
				if (node.type === "task") {
					allTasks.push(node);
				}
			}

			// Filter tasks based on status (if 'all', include all statuses)
			const statusFiltered =
				status === "all"
					? allTasks
					: allTasks.filter((task) => task.status === status);

			// Find the specified todos if provided, otherwise take all status-filtered ones
			let matchedTasks: Task[] = [];

			if (todos.length > 0) {
				// Look for tasks matching the specific descriptions
				matchedTasks = statusFiltered.filter((task) =>
					todos.some((todoText) =>
						task.description
							.toLowerCase()
							.includes(todoText.toLowerCase()),
					),
				);
			} else {
				// No specific todos provided, use all status-filtered tasks
				matchedTasks = statusFiltered;
			}

			// Sort tasks (pending first, then completed, then others)
			matchedTasks.sort((a, b) => {
				const statusOrder: Record<string, number> = {
					pending: 0,
					completed: 1,
					abandoned: 2,
					moved: 3,
				};

				return statusOrder[a.status] - statusOrder[b.status];
			});

			// Limit the number of items if max_items > 0
			const limitedTasks =
				max_items > 0 ? matchedTasks.slice(0, max_items) : matchedTasks;

			// Create result data structure
			const resultData = {
				todos: limitedTasks.map(mapTaskToTodoItem),
				fileName: formattedDate || filePath,
				total: matchedTasks.length,
				showing: limitedTasks.length,
				filePath: filePath,
				interactive: interactive,
			};

			// Return as JSON string
			return JSON.stringify(resultData);
		} catch (error) {
			console.error("Error showing to-do items:", error);
			if (error instanceof ToolExecutionError) {
				throw error;
			} else {
				throw new ToolExecutionError(
					`Error showing to-do items: ${error.message || "Unknown error"}`,
				);
			}
		}
	},

	// Custom renderer for the tool result
	renderResult: (
		result: string,
		input: ShowTodosToolInput,
	): React.ReactNode => {
		try {
			const data = JSON.parse(result);

			// Check if interactivity is disabled
			if (!data.interactive) {
				return React.createElement(TodoDisplay, {
					todos: data.todos,
					fileName: data.fileName,
				});
			}

			// Create functions to handle todo operations
			const handleCheckTodo = async (description: string) => {
				try {
					console.log(`Checking off todo: ${description}`);
					// Cast to any to access plugins
					const app = window.app as any;
					const plugin = app.plugins.plugins["life-navigator"];

					if (!plugin) {
						console.error("Plugin not found");
						return;
					}

					await checkTodoTool.execute(plugin, {
						todos: [{ todo_text: description }],
						file_path: data.filePath,
					});

					// Reload the page to reflect changes
					window.location.reload();
				} catch (e) {
					console.error("Error checking todo:", e);

					// Show error notification
					// @ts-ignore
					new window.Notice(
						t("errors.todos.check").replace(
							"{{error}}",
							e.message || "Unknown error",
						),
					);
				}
			};

			const handleUncheckTodo = async (description: string) => {
				try {
					console.log(`Unchecking todo: ${description}`);
					// Cast to any to access plugins
					const app = window.app as any;
					const plugin = app.plugins.plugins["life-navigator"];

					if (!plugin) {
						console.error("Plugin not found");
						return;
					}

					await uncheckTodoTool.execute(plugin, {
						todo_text: description,
						file_path: data.filePath,
					});

					// Reload the page to reflect changes
					window.location.reload();
				} catch (e) {
					console.error("Error unchecking todo:", e);

					// Show error notification
					// @ts-ignore
					new window.Notice(
						t("errors.todos.uncheck").replace(
							"{{error}}",
							e.message || "Unknown error",
						),
					);
				}
			};

			const handleAbandonTodo = async (description: string) => {
				try {
					console.log(`Abandoning todo: ${description}`);
					// Cast to any to access plugins
					const app = window.app as any;
					const plugin = app.plugins.plugins["life-navigator"];

					if (!plugin) {
						console.error("Plugin not found");
						return;
					}

					await abandonTodoTool.execute(plugin, {
						todos: [{ todo_text: description }],
						file_path: data.filePath,
					});

					// Reload the page to reflect changes
					window.location.reload();
				} catch (e) {
					console.error("Error abandoning todo:", e);

					// Show error notification
					// @ts-ignore
					new window.Notice(
						t("errors.todos.abandon").replace(
							"{{error}}",
							e.message || "Unknown error",
						),
					);
				}
			};

			// Return the TodoDisplay component with interactive handlers
			return React.createElement(TodoDisplay, {
				todos: data.todos,
				fileName: data.fileName,
				onCheckTodo: handleCheckTodo,
				onUncheckTodo: handleUncheckTodo,
				onAbandonTodo: handleAbandonTodo,
			});
		} catch (e) {
			console.error("Error rendering todo display:", e);
			return React.createElement(
				"div",
				{ className: "todo-render-error" },
				`Error displaying todos: ${e.message || "Invalid data"}`,
			);
		}
	},
};
