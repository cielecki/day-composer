import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { TFile } from 'obsidian';
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
import { calculateLineNumberForNode, createNavigationTargetWithContent } from 'src/utils/tools/line-number-utils';
import { extractFilenameWithoutExtension, truncateText } from 'src/utils/text/string-sanitizer';
import { t } from 'src/i18n';
import { cleanTodoText } from 'src/utils/tasks/task-utils';

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
								"The complete text of the to-do item, without the task marker (e.g. '- [ ]'). This should contain all formatting, emojis, time markers, and any other specific formatting you want to include.",
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
    	return t('tools.add.labels.initial');
	},
	execute: async (context: ToolExecutionContext<TaskAddToolInput>): Promise<void> => {
		const { plugin, params } = context;
		const { todos: tasks, path, position, reference_todo_text } = params;

		if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
			context.setLabel(t('tools.add.labels.failed', { task: '', name: 'unknown' }));
			throw new ToolExecutionError("No to-do items provided");
		}

		const todoCount = tasks.length;

		const taskDescriptionShort = todoCount === 1 
			? `'${truncateText(tasks[0].todo_text, 30)}'` 
			: `${todoCount} ${t('tools.tasks.plural')}`;

		context.setLabel(t('tools.add.labels.inProgress'));

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

			for (let i = 0; i < tasks.length; i++) {
				const todo = tasks[i];
				const task: Task = {
					type: "task",
					status: "pending",
					todoText: cleanTodoText(todo.todo_text),
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

			// Create enhanced navigation target with text content
			const lineRange = lineNumbers.length === 1 
				? { start: lineNumbers[0], end: lineNumbers[0] }
				: { start: Math.min(...lineNumbers), end: Math.max(...lineNumbers) };

			// Get the file for reading content
			const vaultFile = plugin.app.vault.getAbstractFileByPath(filePath);
			const fileContent = (vaultFile instanceof TFile) 
				? await plugin.app.vault.read(vaultFile) 
				: undefined;

			const navigationTarget = createNavigationTargetWithContent(
				filePath,
				lineRange,
				fileContent // Include file content for text extraction
			);

			context.addNavigationTarget(navigationTarget);

			// Prepare success message with improved formatting
			const filename = extractFilenameWithoutExtension(filePath);
			const taskDescriptionFull = addedTasks.length === 1 
				? `'${addedTasks[0]}'` 
				: `${addedTasks.length} ${t('tools.tasks.plural')}`;
				
			context.setLabel(t('tools.add.labels.success', {
				task: taskDescriptionShort, 
				name: filename 
			}));

			context.progress(t('tools.add.progress.success', {
				task: taskDescriptionFull,
				name: extractFilenameWithoutExtension(filePath)
			}));
		} catch (error) {
			const filename = extractFilenameWithoutExtension(filePath);
			context.setLabel(t('tools.add.labels.failed', {
				task: taskDescriptionShort, 
				name: filename 
			}));
			throw error;
		}
	}
};
