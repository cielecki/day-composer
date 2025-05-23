import MyPlugin from "../../main";
import { fileExists } from "./fileExists";
import { getFile } from "./getFile";
import { modifyFile } from "./modifyFile";
import {
	appendComment,
	isCommentLine,
	parseTaskContent,
	STATUS_MAP,
	Task,
} from "./task-utils";
import { ToolExecutionError } from "./ToolExecutionError";
import { formatMarkdown } from "./formatMarkdown";
import { t } from "../../i18n";

export type NoteNode = Task | TextBlock;

export interface Note {
	type: "document";
	filePath: string;
	content: NoteNode[];
}

export interface TextBlock {
	type: "text";
	content: string;
	lineIndex: number; // Original line index in document for tracking position
}

/**
 * Find the "current spot" in a document - where newly processed tasks should be placed
 * The insertion point is after the task preceding the first uncompleted one
 * (so any text in between should follow the inserted task)
 * @param document The parsed document
 * @returns The index where new processed tasks should be placed
 */
export function findCurrentSpot(document: Note): number {
	// First, find the index of the first pending task
	let firstPendingIndex = -1;
	for (let i = 0; i < document.content.length; i++) {
		const node = document.content[i];
		if (node.type === "task" && node.status === "pending") {
			firstPendingIndex = i;
			break;
		}
	}

	// If no pending tasks found, insert at the end
	if (firstPendingIndex === -1) {
		return document.content.length;
	}

	// If the first pending task is at the beginning, insert at the beginning
	if (firstPendingIndex === 0) {
		return 0;
	}

	// Find the task that precedes the first pending task
	// We need to find the last task before the first pending task
	let precedingTaskIndex = -1;
	for (let i = firstPendingIndex - 1; i >= 0; i--) {
		const node = document.content[i];
		if (node.type === "task") {
			precedingTaskIndex = i;
			break;
		}
	}

	// If no preceding task found, insert at the beginning
	if (precedingTaskIndex === -1) {
		return 0;
	}

	// Find the end of the preceding task (including any associated text blocks)
	// We need to skip over any text blocks that immediately follow the preceding task
	let insertionIndex = precedingTaskIndex + 1;
	while (insertionIndex < firstPendingIndex && 
		insertionIndex < document.content.length &&
		document.content[insertionIndex].type === "text") {
		insertionIndex++;
	}

	return insertionIndex;
}

export async function readNote({
	plugin,
	filePath,
}: {
	plugin: MyPlugin;
	filePath: string;
}): Promise<Note> {
	const exists = await fileExists(filePath, plugin.app);

	if (!exists) {
		throw new ToolExecutionError(
			t("errors.files.notFound", { path: filePath }),
		);
	}

	const file = getFile(filePath, plugin.app);

	if (!file) {
		throw new ToolExecutionError(
			t("errors.files.getFailed", { path: filePath }),
		);
	}

	try {
		const readFileContent = await plugin.app.vault.read(file);
		const document = parseMarkdown(readFileContent, filePath);
		return document;
	} catch (error) {
		console.error("Error reading file:", error);
		throw new ToolExecutionError(
			t("errors.files.getFailed", { path: filePath }),
		);
	}
}

export async function updateNote({
	plugin,
	filePath,
	updatedNote,
}: {
	plugin: MyPlugin;
	filePath: string;
	updatedNote: Note;
}) {
	const exists = await fileExists(filePath, plugin.app);

	if (!exists) {
		throw new ToolExecutionError(
			t("errors.files.notFound", { path: filePath }),
		);
	}

	const file = getFile(filePath, plugin.app);

	if (!file) {
		throw new ToolExecutionError(
			t("errors.files.getFailed", { path: filePath }),
		);
	}

	// Format the document back to markdown
	const newContent = formatMarkdown(updatedNote);

	if (!newContent) {
		throw new ToolExecutionError(t("errors.files.formatFailed"));
	}

	await modifyFile(file, newContent, plugin.app);
}

/**
 * Find tasks in a document by description
 * @param document The parsed document
 * @param taskDescription The task description to search for
 * @returns Array of matching tasks
 */
export function findTasksByDescription(
	document: Note,
	taskDescription: string,
): Task[] {
	const results: Task[] = [];
	// Helper function to normalize text by converting special characters to ASCII
	const normalizeText = (text: string): string => {
		return text
			.normalize('NFKD') // Decompose characters into base + diacritics
			.replace(/[\u0300-\u036f]/g, '') // Remove diacritics
			.replace(/[^\w\s]/g, '') // Remove remaining special characters
			.toLowerCase()
			.trim();
	};

	// First check if the description contains the search text exactly
	for (const node of document.content) {
		if (node.type === "task") {
			if (node.description.includes(taskDescription)) {
				results.push(node);
			}
		}
	}

  // Check the original line
	if (results.length === 0) {
		for (const node of document.content) {
			if (node.type === "task") {
				if (node.originalLine.includes(taskDescription)) {
					results.push(node);
				}
			}
		}
	}

	// If not found verbatim, check with special characters ignored
	if (results.length === 0) {
		const normalizedSearch = normalizeText(taskDescription);
    console.log('normalizedSearch', normalizedSearch);
    
		for (const node of document.content) {
			if (node.type === "task") {
				const normalizedLine = normalizeText(node.originalLine);
				if (normalizedLine.includes(normalizedSearch)) {
					results.push(node);
				}
			}
		}
	}

	return results;
}

/**
 * Find a task in a document by description (throws if not found or multiple found)
 * @param note The parsed document
 * @param taskDescription The task description to search for
 * @returns The matching task
 */
export function findTaskByDescription(
	note: Note,
	taskDescription: string,
): Task {
	// Find the task
	const tasks = findTasksByDescription(note, taskDescription);

	if (tasks.length === 0) {
		throw new ToolExecutionError(
			t("errors.tasks.notFound", { task: taskDescription, path: note.filePath }),
		);
	}

	if (tasks.length > 1) {
		throw new ToolExecutionError(
			t("errors.tasks.multipleFound", { task: taskDescription, path: note.filePath }),
		);
	}

	const task = tasks[0];

	return task;
}

/**
 * Determines the insertion position for tasks based on specified positioning strategy
 * @param note The parsed document
 * @param position The positioning strategy: beginning, end, or after
 * @param afterTodoText The description of a task to insert after (required when position is 'after')
 * @returns The index where new tasks should be placed
 */
export function determineInsertionPosition(
	note: Note,
	position: "beginning" | "end" | "after",
	afterTodoText?: string,
): number {
	if (position === "beginning") {
		// Insert at the first pending task or beginning
		return findCurrentSpot(note);
	} else if (position === "end") {
		// Insert at the end of the document
		return note.content.length;
	} else if (position === "after") {
		// Validate that after_todo_text is provided
		if (!afterTodoText) {
			throw new ToolExecutionError(
				"When position is 'after', you must provide 'after_todo_text' to specify which to-do to insert after",
			);
		}

		try {
			// Find the task by description
			const referenceTask = findTaskByDescription(note, afterTodoText);

			// Find its index in the document
			let foundIndex = -1;
			for (let i = 0; i < note.content.length; i++) {
				const node = note.content[i];
				if (
					node.type === "task" &&
					node.description === referenceTask.description &&
					node.status === referenceTask.status
				) {
					foundIndex = i;
					break;
				}
			}

			if (foundIndex === -1) {
				throw new ToolExecutionError(
					`Could not determine the position of reference task "${afterTodoText}"`,
				);
			}

			// Set insertion point to be after this task
			return foundIndex + 1;
		} catch (error) {
			throw new ToolExecutionError(
				`Error finding reference task: ${error.message}`,
			);
		}
	}

	// Default case
	return 0;
}

/**
 * Parse markdown content into a structured document representation
 * @param markdown The markdown content to parse
 * @returns A structured document representation
 */
export function parseMarkdown(markdown: string, filePath: string): Note {
	const document: Note = { type: "document", content: [], filePath };
	const lines = markdown.split("\n");

	let current: Task | TextBlock | null = null;
	let lineIndex = 0;

	for (const line of lines) {
		const taskMatch = line.match(/^-\s+\[([ x\->])\]\s*(.*?)$/);

		if (current?.type == "task" && isCommentLine(line)) {
			//check for continuation of task
			appendComment(current, line);
		} else if (taskMatch) {
			//check for start of task
			const statusChar = taskMatch[1];
			const taskContent = taskMatch[2];

			// Parse task details
			const parsedTask = parseTaskContent(taskContent);

			// Create task object
			const newTask: Task = {
				type: "task",
				status:
					STATUS_MAP[statusChar as keyof typeof STATUS_MAP] ||
					"pending",
				emoji: parsedTask.emoji,
				timeInfo: {
					scheduled: parsedTask.scheduled,
					completed: parsedTask.completed,
				},
				description: parsedTask.description,
				originalLine: line,
				comment: "",
				target: parsedTask.target,
				source: parsedTask.source,
				lineIndex,
			};

			document.content.push(newTask);
			current = newTask;
		} else {
			if (current?.type == "text") {
				current.content += "\n" + line;
			} else {
				const newTextBlock: TextBlock = {
					type: "text",
					content: line,
					lineIndex,
				};

				document.content.push(newTextBlock);
				current = newTextBlock;
			}
		}

		lineIndex++;
	}

	return document;
}
