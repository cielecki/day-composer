import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { Task } from 'src/utils/tasks/task-utils';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { ObsidianTool } from 'src/obsidian-tools';
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import {
	readNote,
	updateNote,
	determineInsertionPosition,
} from 'src/utils/tools/note-utils';
import { getDailyNotePath } from 'src/utils/daily-notes/get-daily-note-path';
import { insertTaskAtPosition } from 'src/utils/tasks/task-utils';
import { calculateLineNumberForNode, createNavigationTarget } from 'src/utils/tools/line-number-utils';
import { extractFilenameWithoutExtension, truncateText } from 'src/utils/text/string-sanitizer';
import { t } from 'src/i18n';

const schema = {
	name: "task_add",
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

type TaskAddToolInput = {
	todos: TodoItem[];
	path?: string;
	position: "beginning" | "end" | "before" | "after";
	reference_todo_text?: string;
};

export const taskAddTool: ObsidianTool<TaskAddToolInput> = {
	specification: schema,
	icon: "list-plus",
	sideEffects: true, // Modifies files by adding tasks
	get initialLabel() {
		return t('tools.add.label');
	},
	execute: async (context: ToolExecutionContext<TaskAddToolInput>): Promise<void> => {
		const { plugin, params } = context;
		const { todos, path, position, reference_todo_text } = params;

		if (!todos || !Array.isArray(todos) || todos.length === 0) {
			context.setLabel(t('tools.actions.add.failed', { task: '' }));
			throw new ToolExecutionError("No to-do items provided");
		}

		const todoCount = todos.length;
		let actionText = "";
		
		if (todoCount === 1) {
			actionText = `\`${truncateText(todos[0].todo_text, 30)}\``;
		} else {
			actionText = `${todoCount} todos`;
		}

		context.setLabel(t('tools.actions.add.inProgress', { task: actionText }));

		const filePath = path ? path : await getDailyNotePath(plugin.app);

		try {
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

			// Prepare success message with improved formatting
			const filename = extractFilenameWithoutExtension(filePath);
			const tasksDescription = addedTasks.length === 1 
				? `"${truncateText(addedTasks[0], 20)}"` 
				: `${addedTasks.length} ${t('tools.tasks.plural')}`;
			const taskDescriptionFull = addedTasks.length === 1 
				? `"${addedTasks[0]}"` 
				: `${addedTasks.length} ${t('tools.tasks.plural')}`;
				
			context.setLabel(t('tools.actions.add.success', { 
				task: actionText, 
				filename: filename 
			}));
			context.progress(t('tools.success.add', {
				task: taskDescriptionFull,
				path: filePath
			}));
		} catch (error) {
			const filename = extractFilenameWithoutExtension(filePath);
			context.setLabel(t('tools.actions.add.failed', { 
				task: actionText, 
				filename: filename 
			}));
			throw error;
		}
	}
};
