import { ToolExecutionError } from 'src/types/tool-execution-error';
import { Note } from '../../utils/tools/note-utils';
import { t } from 'src/i18n';

export interface Task {
  type: 'task';
  status: 'pending' | 'completed' | 'abandoned' | 'moved';
  todoText: string; // Everything after the checkbox brackets - includes emojis, time markers, formatting, etc.
  comment: string;
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
 * Add a comment to a task
 * @param task The task to add a comment to
 * @param comment The comment to add
 * @param timestamp Optional timestamp to include with the note
 * @returns The updated task
 */
export function addCommentToTask(
  task: Task,
  comment: string | undefined,
  timestamp: string | null = null
): Task {
  // Create a copy to avoid modifying the original
  const updatedTask: Task = JSON.parse(JSON.stringify(task));
  
  // Skip if no comment provided
  if (!comment) {
    return updatedTask;
  }
  
  // Format comment with timestamp if provided
  const formattedComment = timestamp
    ? `(${timestamp}) ${comment}`
    : comment;
    
  // Add the comment
  appendComment(updatedTask, formattedComment);
  
  return updatedTask;
}

/**
 * Format a task to markdown
 * @param task The task to format
 * @returns Markdown string representation
 */
export function formatTask(task: Task): string {
  const statusChar = REVERSE_STATUS_MAP[task.status];

  // Build task line
  const taskLine = `- [${statusChar}] ${task.todoText}`;

  // Add notes if present
  if (task.comment.length > 0) {
    return `${taskLine}\n${task.comment}`;
  } else {
    return taskLine;
  }
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

export function appendComment(task: Task, comment: string | undefined) {
  // Handle undefined, null, or empty comment
  if (!comment) {
    return;
  }
  
  // Split the line into individual lines to handle multi-line comments properly
  const lines = comment.split('\n');
  
  // Process each line individually for proper indentation
  const indentedLines = lines.map(singleLine => {
    // Only add indentation if the line is not already indented
    return isCommentLine(singleLine) ? singleLine : '    ' + singleLine;
  });
  
  const indentedComment = indentedLines.join('\n');
  task.comment = task.comment ? task.comment + "\n" + indentedComment : indentedComment;
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
      node.todoText === taskToRemove.todoText &&
      node.status === taskToRemove.status) {
      newDocument.content.splice(i, 1);
      return newDocument;
    }
  }

  throw new ToolExecutionError(t('errors.tasks.removeNotFound')
    .replace('{{task}}', taskToRemove.todoText));
}

