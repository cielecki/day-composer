import MyPlugin from "../main";
import { createFile } from "../utils/fs/create-file";
import { fileExists } from "./utils/fileExists";
import { Task } from "./utils/task-utils";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { ObsidianTool, NavigationTarget, ToolExecutionResult } from "../obsidian-tools";
import {
	readNote,
	updateNote,
	determineInsertionPosition,
} from "./utils/note-utils";
import { getDailyNotePath } from "./utils/getDailyNotePath";
import { insertTaskAtPosition } from "./utils/task-utils";
import { calculateLineNumberForNode, createNavigationTarget } from "./utils/line-number-utils";
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
					"Where to place the to-do items: 'beginning' (at the current spot), 'end' (at the end of the list), 'before' (before a specific to-do), or 'after' (after a specific to-do)",
				enum: ["beginning", "end", "before", "after"],
			},
			reference_todo_text: {
				type: "string",
				description:
					"When position is 'before' or 'after', this is the complete text of the reference to-do item for positioning.",
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
	position: "beginning" | "end" | "before" | "after";
	reference_todo_text?: string;
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
	execute: async (plugin: MyPlugin, params: AddTodoToolInput): Promise<ToolExecutionResult> => {
		const { todos, path, position, reference_todo_text } = params;

		if (!todos || !Array.isArray(todos) || todos.length === 0) {
			throw new ToolExecutionError("No to-do items provided");
		}

		const filePath = path ? path : await getDailyNotePath(plugin.app);

		// Check if file exists, create if it doesn't
		const exists = await fileExists(filePath, plugin.app);
		if (!exists) {
			await createFile(filePath, "", plugin.app);
		}

		// Read the note
		const note = await readNote({ plugin, filePath });

		// Determine insertion position
		const insertionIndex = determineInsertionPosition(
			note,
			position,
			reference_todo_text,
		);

		// Create task objects and insert them
		let updatedNote = JSON.parse(JSON.stringify(note));
		const addedTasks: string[] = [];
		const addedTaskObjects: Task[] = [];

		for (let i = 0; i < todos.length; i++) {
			const todo = todos[i];
			const task: Task = {
				type: "task",
				status: "pending",
				todoText: todo.todo_text,
				comment: "",
				lineIndex: -1, // Will be updated when the note is saved
			};

			// Insert at the calculated position + i to maintain order
			updatedNote = insertTaskAtPosition(
				updatedNote,
				task,
				insertionIndex + i,
			);
			addedTasks.push(todo.todo_text);
			addedTaskObjects.push(task);
		}

		// Update the note
		await updateNote({ plugin, filePath, updatedNote });

		// Calculate line numbers for the added tasks
		const lineNumbers: number[] = [];
		for (let i = 0; i < addedTaskObjects.length; i++) {
			lineNumbers.push(calculateLineNumberForNode(updatedNote, insertionIndex + i));
		}

		// Create navigation target
		const navigationTargets = [createNavigationTarget(
			filePath,
			lineNumbers,
			`Navigate to added todo${addedTasks.length > 1 ? 's' : ''}`
		)];

		// Prepare success message
		const tasksDescription = addedTasks.length === 1 
			? `"${addedTasks[0]}"` 
			: `${addedTasks.length} ${t('tools.tasks.plural')}`;
			
		const resultMessage = t('tools.success.add')
			.replace('{{task}}', tasksDescription)
			.replace('{{path}}', filePath);

		return {
			result: resultMessage,
			navigationTargets: navigationTargets
		};
	}
};
