import MyPlugin from "../main";
import { createFile } from "./utils/createFile";
import { fileExists } from "./utils/fileExists";
import { Task } from "./utils/task-utils";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { ObsidianTool } from "../obsidian-tools";
import {
	readNote,
	updateNote,
	determineInsertionPosition,
} from "./utils/note-utils";
import { getDailyNotePath } from "./utils/getDailyNotePath";
import { insertTaskAtPosition } from "./utils/task-utils";
import { t } from "../i18n";

const schema = {
	name: "add_todo",
	description:
		"Adds one or more to-do items to a specified document or today's daily note",
	input_schema: {
		type: "object",
		properties: {
			todos: {
				type: "array",
				description: "Array of to-do items to add",
				items: {
					type: "object",
					properties: {
						todo_text: {
							type: "string",
							description:
								"The complete text of the to-do item. This should contain all formatting, emojis, time markers, and any other specific formatting you want to include.",
						},
					},
					required: ["todo_text"],
				},
			},
			path: {
				type: "string",
				description:
					"The path of the document to add the to-do items to (including .md extension). If not provided, adds to today's daily note.",
			},
			position: {
				type: "string",
				description:
					"Where to place the to-do items: 'beginning' (at the current spot), 'end' (at the end of the list), or 'after' (after a specific to-do)",
				enum: ["beginning", "end", "after"],
			},
			after_todo_text: {
				type: "string",
				description:
					"When position is 'after', this is the complete text of the to-do item after which the new items should be placed.",
			},
		},
		required: ["todos", "position"],
	},
};

type TodoItem = {
	todo_text: string;
};

type AddTodoToolInput = {
	todos: TodoItem[];
	path?: string;
	position: "beginning" | "end" | "after";
	after_todo_text?: string;
};

export const addTodoTool: ObsidianTool<AddTodoToolInput> = {
	specification: schema,
	icon: "list-plus",
	getActionText: (
		input: AddTodoToolInput,
		output: string,
		hasResult: boolean,
		hasError: boolean,
	) => {
		if (hasResult) {
			// Only process task text for completed operations
			let actionText = "";
			if (!input || typeof input !== "object") actionText = "";
			const todoCount = input.todos?.length || 0;
			
			if (todoCount === 1) {
				actionText = `"${input.todos[0].todo_text}"`;
			} else {
				// Use proper pluralization based on count
				const countKey = todoCount === 0 ? 'zero' :
									todoCount === 1 ? 'one' :
									todoCount % 10 >= 2 && todoCount % 10 <= 4 && (todoCount % 100 < 10 || todoCount % 100 >= 20) ? 'few' : 'many';
				
				// Check if the translation key exists
				try {
					const translation = t(`tools.tasks.count.${countKey}`, { count: todoCount });
					actionText = translation !== `tools.tasks.count.${countKey}` ? translation : `${todoCount} ${t('tools.tasks.plural')}`;
				} catch (e) {
					// Fallback to simple pluralization
					actionText = `${todoCount} ${t('tools.tasks.plural')}`;
				}
			}

			return hasError
				? t('tools.actions.add.failed', { defaultValue: `Failed to add ${actionText}` }).replace('{{task}}', actionText)
				: t('tools.actions.add.success', { defaultValue: `Added ${actionText}` }).replace('{{task}}', actionText);
		} else {
			// For in-progress operations, don't show task details
			return t('tools.actions.add.inProgress', { defaultValue: 'Adding todo...' }).replace('{{task}}', '');
		}
	},
	execute: async (
		plugin: MyPlugin,
		params: AddTodoToolInput,
	): Promise<string> => {
		const { todos, position } = params;

		if (!todos || !Array.isArray(todos) || todos.length === 0) {
			throw new ToolExecutionError("No to-do items provided");
		}

		// If no path is provided, use today's daily note
		const filePath = params.path
			? params.path
			: await getDailyNotePath(plugin.app);

		// Handle file creation if it doesn't exist
		const exists = await fileExists(filePath, plugin.app);
		if (!exists) {
			try {
				await createFile(filePath, "", plugin.app);
			} catch (error) {
				throw new ToolExecutionError(
					`Could not create file at ${filePath}: ${error.message}`,
				);
			}
		}

		// Read the note
		const note = await readNote({ plugin, filePath });

		// Determine insertion position based on user's preference
		let insertionIndex = determineInsertionPosition(
			note,
			position,
			params.after_todo_text,
		);

		let updatedNote = note;
		const addedTodos: string[] = [];

		// Process each to-do item
		for (let i = 0; i < todos.length; i++) {
			const { todo_text } = todos[i];

			// Create the task object
			const task: Task = {
				type: 'task',
				status: 'pending',
				todoText: todo_text,
				comment: "",
				lineIndex: -1 // Will be set when inserted
			};

			// Insert the task at the determined position
			updatedNote = insertTaskAtPosition(
				updatedNote,
				task,
				insertionIndex,
			);

			insertionIndex++;

			addedTodos.push(`"${todo_text}"`);
		}

		// Update the file with the new content
		await updateNote({ plugin, filePath, updatedNote });

		// Return success message
		const todoDescription =
			todos.length === 1
				? addedTodos[0]
				: `${todos.length} to-dos (${addedTodos.join(", ")})`;

		// Include reference task in the success message if applicable
		const positionDetail =
			position === "after"
				? `after "${params.after_todo_text}"`
				: `at ${position} position`;

		return `✓ Added ${todoDescription} to ${filePath} ${positionDetail}`;
	},
};
