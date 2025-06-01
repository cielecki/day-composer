import MyPlugin from "../../main";
import { App, TFile } from "obsidian";
import { fileExists } from "./file-exists";
import { getFile } from "./get-file";
import { modifyFile } from "./modify-file";
import {
	appendComment,
	isCommentLine,
	STATUS_MAP,
	Task,
} from "./task-utils";
import { ToolExecutionError } from "./tool-execution-error";
import { formatMarkdown } from "./format-markdown";
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
 * Normalize text by converting special characters to ASCII equivalents
 * Useful for fuzzy matching that ignores diacritics and special characters
 * @param text The text to normalize
 * @returns Normalized text
 */
export function normalizeText(text: string): string {
	return text
		.normalize('NFKD') // Decompose characters into base + diacritics
		.replace(/[\u0300-\u036f]/g, '') // Remove diacritics
		.replace(/[^\w\s]/g, '') // Remove remaining special characters
		.toLowerCase()
		.trim();
}

/**
 * Find tasks in a document by description using tiered matching strategy
 * @param document The parsed document
 * @param todoText The task description to search for
 * @param taskPredicate A predicate to filter the tasks to search in (applied only to tasks)
 * @returns Array of matching tasks ordered by match quality (exact matches first)
 */
export function findTasksByDescription(
	document: Note,
	todoText: string,
	taskPredicate: (task: Task) => boolean,
): Task[] {

	// Precompute search terms
	const trimmedTodoText = todoText.trim();
	const normalizedSearchText = normalizeText(todoText);

	// Extract and filter tasks in a single pass
	const tasks = document.content
		.filter((node): node is Task => node.type === "task")
		.filter(taskPredicate);

	// Results arrays for different match tiers
	const exactMatches: Task[] = [];
	const partialMatches: Task[] = [];
	const normalizedMatches: Task[] = [];

	// Single pass through filtered tasks
	for (const task of tasks) {
		const trimmedTaskText = task.todoText.trim();

		// Tier 1: Exact match
		if (trimmedTaskText === trimmedTodoText) {
			exactMatches.push(task);
			continue; // Skip other checks for exact matches
		}

		// Tier 2: Partial match
		if (trimmedTaskText.includes(trimmedTodoText)) {
			partialMatches.push(task);
			continue; // Skip normalization for partial matches
		}

		// Tier 3: Normalized partial match (only if no exact/partial matches)
		const normalizedTaskText = normalizeText(task.todoText);
		if (normalizedTaskText.includes(normalizedSearchText)) {
			normalizedMatches.push(task);
		}
	}

	// Return best matches first, falling back to lower tiers only if higher tiers are empty
	if (exactMatches.length > 0) {
		return exactMatches;
	}
	if (partialMatches.length > 0) {
		return partialMatches;
	}
	return normalizedMatches;
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
	taskPredicate: (task: Task) => boolean,
): Task {
	// Find the task
	const tasks = findTasksByDescription(note, taskDescription, taskPredicate);

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
 * @param position The positioning strategy: beginning, end, before, or after
 * @param referenceTodoText The description of a reference task for positioning (required when position is 'before' or 'after')
 * @returns The index where new tasks should be placed
 */
export function determineInsertionPosition(
	note: Note,
	position: "beginning" | "end" | "before" | "after",
	referenceTodoText?: string,
): number {
	if (position === "beginning") {
		// Insert at the first pending task or beginning
		return findCurrentSpot(note);
	} else if (position === "end") {
		// Insert at the end of the document
		return note.content.length;
	} else if (position === "before" || position === "after") {
		// Validate that reference_todo_text is provided
		if (!referenceTodoText) {
			throw new ToolExecutionError(
				`When position is '${position}', you must provide 'reference_todo_text' to specify the reference to-do`,
			);
		}

		try {
			// Find the task by description
			const referenceTask = findTaskByDescription(note, referenceTodoText, () => true);

			// Find its index in the document
			let foundIndex = -1;
			for (let i = 0; i < note.content.length; i++) {
				const node = note.content[i];
				if (
					node.type === "task" &&
					node.todoText === referenceTask.todoText &&
					node.status === referenceTask.status
				) {
					foundIndex = i;
					break;
				}
			}

			if (foundIndex === -1) {
				throw new ToolExecutionError(
					`Could not determine the position of reference task "${referenceTodoText}"`,
				);
			}

			// Set insertion point based on position
			if (position === "before") {
				return foundIndex; // Insert before the reference task
			} else {
				return foundIndex + 1; // Insert after the reference task
			}
		} catch (error) {
			throw new ToolExecutionError(
				`Error finding reference task: ${error.message}`,
			);
		}
	} else {
		throw new ToolExecutionError(
			`Invalid position: ${position}`,
		);
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
	let insideHtmlComment = false;

	for (const line of lines) {
		// Check for HTML comment start/end markers
		const commentStartMatch = line.match(/<!--/);
		const commentEndMatch = line.match(/-->/);
		
		// Update HTML comment state
		if (commentStartMatch && commentEndMatch) {
			// Single line comment (<!-- content -->)
			insideHtmlComment = false; // Reset state after single-line comment
		} else if (commentStartMatch) {
			// Multi-line comment start
			insideHtmlComment = true;
		} else if (commentEndMatch) {
			// Multi-line comment end
			insideHtmlComment = false;
		}

		// Only try to parse tasks if we're not inside an HTML comment
		const taskMatch = !insideHtmlComment ? line.match(/^-\s+\[([ x\->])\]\s*(.*?)$/) : null;

		if (current?.type == "task" && isCommentLine(line)) {
			//check for continuation of task
			appendComment(current, line);
		} else if (taskMatch) {
			//check for start of task
			const statusChar = taskMatch[1];
			const taskContent = taskMatch[2];

			// Parse task details - simplified to just return the content as-is
			const todoText = taskContent.trim();

			// Create task object
			const newTask: Task = {
				type: "task",
				status:
					STATUS_MAP[statusChar as keyof typeof STATUS_MAP] ||
					"pending",
				todoText: todoText,
				comment: "",
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
