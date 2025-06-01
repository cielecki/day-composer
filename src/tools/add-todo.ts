import MyPlugin from "../main";
import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { Task } from "../utils/task/task-utils";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import {
	findCurrentSpot,
	readNote,
	updateNote,
	Note,
	NoteNode,
	TextBlock,
	determineInsertionPosition
} from "../utils/tools/note-utils";
import { getDailyNotePath } from "../utils/daily-notes/get-daily-note-path";
import { insertTaskAtPosition } from "../utils/task/task-utils";
import { calculateLineNumberForNode, createNavigationTarget } from "../utils/tools/line-number-utils";
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
		hasStarted: boolean,
		hasCompleted: boolean,
		hasError: boolean,
	) => {
		let actionText = "";
		if (!input || typeof input !== "object") return '';
		const todoCount = input.todos?.length || 0;
		
		if (todoCount === 1) {
			actionText = `"${input.todos[0].todo_text}"`;
		} else {
			// Use proper pluralization based on count with static translation keys
			let translation = '';
			if (todoCount === 0) {
				translation = t('tools.tasks.count.zero', { count: todoCount });
			} else if (todoCount === 1) {
				translation = t('tools.tasks.count.one', { count: todoCount });
			} else if (todoCount % 10 >= 2 && todoCount % 10 <= 4 && (todoCount % 100 < 10 || todoCount % 100 >= 20)) {
				translation = t('tools.tasks.count.few', { count: todoCount });
			} else {
				translation = t('tools.tasks.count.many', { count: todoCount });
			}
			
			// Check if translation was successful, fallback to simple pluralization if not
			if (translation && !translation.startsWith('tools.tasks.count.')) {
				actionText = translation;
			} else {
				actionText = `${todoCount} ${t('tools.tasks.plural')}`;
			}
		}

		if (hasError) {
			return t('tools.actions.add.failed', { defaultValue: `Failed to add ${actionText}` }).replace('{{task}}', actionText);
		} else if (hasCompleted) {
			return t('tools.actions.add.success', { defaultValue: `Added ${actionText}` }).replace('{{task}}', actionText);
		} else if (hasStarted) {
			return t('tools.actions.add.inProgress', { defaultValue: 'Adding todo...' }).replace('{{task}}', '');
		} else {
			return t('tools.actions.add.default').replace('{{task}}', actionText);
		}
	},
	execute: async (context: ToolExecutionContext<AddTodoToolInput>): Promise<void> => {
		const { plugin, params } = context;
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
		const navigationTarget = createNavigationTarget(
			filePath,
			lineNumbers,
			`Navigate to added todo${addedTasks.length > 1 ? 's' : ''}`
		);

		context.addNavigationTarget(navigationTarget);

		// Prepare success message
		const tasksDescription = addedTasks.length === 1 
			? `"${addedTasks[0]}"` 
			: `${addedTasks.length} ${t('tools.tasks.plural')}`;
			
		context.progress(t('tools.success.add', {
			task: tasksDescription,
			path: filePath
		}));
	}
};
