import { ToolExecutionError } from "./ToolExecutionError";
import { Note } from "./note-utils";
import { t } from "../../i18n";

export interface Task {
  type: 'task';
  status: 'pending' | 'completed' | 'abandoned' | 'moved';
  emoji: string | null;
  timeInfo: {
    scheduled: string | null; // "09:00-10:00" or "~13:30"
    completed: string | null; // "15:40" or "2023-10-18 15:40"
  };
  description: string;
  originalLine: string; // The original full text line of the task
  comment: string;
  target: string | null; // For moved tasks, e.g., "2023-10-20"
  source: string | null; // For tasks moved from elsewhere
  lineIndex: number; // Original line index in document for tracking position
}


/**
 * Status mapping from markdown to internal representation
 */
export const STATUS_MAP = {
  ' ': 'pending',
  'x': 'completed',
  '-': 'abandoned',
  '>': 'moved'
} as const;


/**
 * Reverse status mapping from internal representation to markdown
 */
export const REVERSE_STATUS_MAP = {
  'pending': ' ',
  'completed': 'x',
  'abandoned': '-',
  'moved': '>'
} as const


/**
 * Create a new task with the specified properties
 * @param description The task description
 * @param emoji Optional emoji for the task
 * @param scheduled Optional scheduled time (e.g. "09:00-10:00", "~13:30")
 * @returns A new Task object
 */
export function createTask(
  description: string,
  emoji: string | null = null,
  scheduled: string | null = null
): Task {
  // Create the task object
  const task: Task = {
    type: 'task',
    status: 'pending',
    emoji,
    timeInfo: {
      scheduled,
      completed: null
    },
    description,
    originalLine: `- [ ] ${emoji ? emoji + ' ' : ''}${scheduled ? scheduled + ' ' : ''}${description}`,
    comment: "",
    target: null,
    source: null,
    lineIndex: -1 // Will be set when inserted
  };

  return task;
}


/**
 * Uncheck (uncomplete) a task
 * @param task The task to uncheck
 * @returns The updated task
 */
export function uncheckTask(task: Task): Task {
  // Create a copy to avoid modifying the original
  const updatedTask: Task = JSON.parse(JSON.stringify(task));
  
  // Update status and remove completion time
  
  
  return updatedTask;
}


/**
 * Move a task to another date or backlog
 * @param task The task to move
 * @param target The target date (YYYY-MM-DD) or backlog name
 * @returns The updated task marked as moved
 */
export function markTaskAsMoved(
  task: Task,
  target: string
): Task {
  // Create a copy to avoid modifying the original
  const updatedTask: Task = JSON.parse(JSON.stringify(task));
  
  // Update status and target
  updatedTask.status = 'moved';
  updatedTask.target = target;
  
  return updatedTask;
}

/**
 * Create a task in target file from a moved task
 * @param task The original task that was moved
 * @param source The source file or date
 * @returns A new task for the target file
 */
export function createMovedTask(
  task: Task,
  source: string
): Task {
  // Create a copy to avoid modifying the original
  const newTask: Task = JSON.parse(JSON.stringify(task));
  
  // Reset status to original (pending or completed)
  // But mark the source
  newTask.status = task.status === 'moved' ? 'pending' : task.status;
  newTask.target = null;
  newTask.source = source;
  
  return newTask;
}

/**
 * Add a comment to a task
 * @param task The task to add a comment to
 * @param comment The comment to add
 * @param timestamp Optional timestamp to include with the note
 * @returns The updated task
 */
export function addCommentToTask(
  task: Task,
  comment: string,
  timestamp: string | null = null
): Task {
  // Create a copy to avoid modifying the original
  const updatedTask: Task = JSON.parse(JSON.stringify(task));
  
  // Format comment with timestamp if provided
  const formattedComment = timestamp
    ? `(${timestamp}) ${comment}`
    : comment;
    
  // Add the comment
  appendCommentLine(updatedTask, formattedComment);
  
  return updatedTask;
}

/**
 * Format a task to markdown
 * @param task The task to format
 * @returns Markdown string representation
 */
export function formatTask(task: Task): string {
  const statusChar = REVERSE_STATUS_MAP[task.status];
  const emoji = task.emoji ? `${task.emoji} ` : '';

  // Format timeInfo
  let timeStr = '';
  if (task.timeInfo.scheduled) {
    timeStr = `${task.timeInfo.scheduled} `;
  }

  // Format completion time if present and task is completed
  let completionStr = '';
  if (task.status === 'completed' && task.timeInfo.completed) {
    completionStr = t('tasks.format.completionTime').replace('{{time}}', task.timeInfo.completed);
  }

  // Format target if moved
  let targetStr = '';
  if (task.status === 'moved' && task.target) {
    targetStr = t('tasks.format.movedTo').replace('{{target}}', task.target);
  }

  // Format source if this task was moved from elsewhere
  let sourceStr = '';
  if (task.source) {
    sourceStr = t('tasks.format.movedFrom').replace('{{source}}', task.source);
  }

  // Build task line
  const taskLine = `- [${statusChar}] ${emoji}${timeStr}${task.description}${completionStr}${targetStr}${sourceStr}`;

  // Add notes if present
  if (task.comment.length > 0) {
    return `${taskLine}\n${task.comment}`;
  } else {
    return taskLine;
  }
}
/**
 * Parse task content to extract emoji, time information, and description
 * @param content The task content (everything after the status checkbox)
 * @returns Parsed task components
 */
export function parseTaskContent(content: string): {
  emoji: string | null;
  scheduled: string | null;
  completed: string | null;
  description: string;
  target: string | null;
  source: string | null;
} {
  const result = {
    emoji: null as string | null,
    scheduled: null as string | null,
    completed: null as string | null,
    description: content.trim(),
    target: null as string | null,
    source: null as string | null
  };

  // Extract emoji if present (assuming emoji is a single character at the start)
  const emojiMatch = content.match(/^(\p{Emoji})\s+(.+)$/u);
  if (emojiMatch) {
    result.emoji = emojiMatch[1];
    result.description = emojiMatch[2].trim();
  }

  // Extract scheduled time if present
  // Match time ranges like 09:00-10:00 or approximate times like ~13:30
  const scheduledMatch = result.description.match(/^((?:[0-9]{1,2}:[0-9]{2}-[0-9]{1,2}:[0-9]{2})|(?:~[0-9]{1,2}:[0-9]{2}))\s+(.+)$/);
  if (scheduledMatch) {
    result.scheduled = scheduledMatch[1];
    result.description = scheduledMatch[2].trim();
  }

  // Extract completion time if present (at the end in parentheses)
  const completedMatch = result.description.match(/(.+?)\s+\(([0-9]{1,2}:[0-9]{2}(?:\s+[0-9]{4}-[0-9]{2}-[0-9]{2})?)\)$/);
  if (completedMatch) {
    result.description = completedMatch[1].trim();
    result.completed = completedMatch[2];
  }

  // Extract target for moved tasks
  const targetMatch = result.description.match(/(.+?)\s+→\s+(.+)$/);
  if (targetMatch) {
    result.description = targetMatch[1].trim();
    result.target = targetMatch[2];
  }

  // Extract source information
  const sourceMatch = result.description.match(/(.+?)\s+\(from\s+(.+?)\)$/);
  if (sourceMatch) {
    result.description = sourceMatch[1].trim();
    result.source = sourceMatch[2];
  }

  return result;
}

/**
 * Insert a task at the specified position in a document
 * @param document The document to modify
 * @param task The task to insert
 * @param index The index where the task should be inserted
 * @returns The modified document
 * @throws {ToolExecutionError} If the index is out of bounds
 */
export function insertTaskAtPosition(
  document: Note,
  task: Task,
  index: number
): Note {
  // Check if index is out of bounds
  if (index < 0 || index > document.content.length) {
    throw new ToolExecutionError(t('errors.tasks.insertOutOfBounds')
      .replace('{{index}}', String(index))
      .replace('{{total}}', String(document.content.length)));
  }

  // Create a copy of the document to avoid modifying the original
  const newDocument = JSON.parse(JSON.stringify(document)) as Note;

  // if (task.comment.length > 0) {
  //   // Insert the task at the specified index
  //   const splitter: TextBlock = {
  //     type: 'text',
  //     content: '',
  //     lineIndex: -1
  //   }
  //   newDocument.content.splice(index, 0, task, splitter);
  // } else {
  newDocument.content.splice(index, 0, task);
  // }

  return newDocument;
}

export function isCommentLine(line: string) {
  return line.startsWith("> ") || line.startsWith("    ") || line.startsWith("\t");
}

export function appendCommentLine(task: Task, line: string) {
  const indentedLine = isCommentLine(line) ? line : '    ' + line;

  task.comment = task.comment ? task.comment + "\n" + indentedLine : indentedLine;
}

/**
 * Remove a task from a document
 * @param document The document to modify
 * @param taskToRemove The task to remove
 * @returns The modified document
 * @throws {ToolExecutionError} If the task is not found in the document
 */
export function removeTaskFromDocument(document: Note, taskToRemove: Task): Note {
  // Create a copy to avoid modifying the original
  const newDocument = JSON.parse(JSON.stringify(document)) as Note;

  for (let i = 0; i < newDocument.content.length; i++) {
    const node = newDocument.content[i];

    if (node.type === 'task' &&
      node.description === taskToRemove.description &&
      node.status === taskToRemove.status) {
      newDocument.content.splice(i, 1);
      return newDocument;
    }
  }

  throw new ToolExecutionError(t('errors.tasks.removeNotFound')
    .replace('{{task}}', taskToRemove.description));
}

