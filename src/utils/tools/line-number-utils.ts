import { Note } from "./note-utils";
import { Task } from "../task/task-utils";
import { NavigationTarget } from "../../obsidian-tools";

/**
 * Calculate the line number (1-based) for a node at the given index in a note
 * @param note The parsed note
 * @param nodeIndex The index of the node in the note's content array
 * @returns The line number where this node starts
 */
export function calculateLineNumberForNode(note: Note, nodeIndex: number): number {
  let lineNumber = 1;
  
  for (let i = 0; i < nodeIndex && i < note.content.length; i++) {
    const node = note.content[i];
    if (node.type === 'text') {
      // Count lines in text blocks
      lineNumber += node.content.split('\n').length;
    } else if (node.type === 'task') {
      // Each task takes at least one line, plus any comment lines
      lineNumber += 1;
      if (node.comment) {
        lineNumber += node.comment.split('\n').length;
      }
    }
  }
  
  return lineNumber;
}

/**
 * Calculate the line range for a task including its comments
 * @param note The parsed note
 * @param taskIndex The index of the task in the note's content array
 * @returns The line range { start, end } that includes the task and its comments
 */
export function calculateTaskLineRange(note: Note, taskIndex: number): { start: number; end: number } {
  const startLine = calculateLineNumberForNode(note, taskIndex);
  let endLine = startLine;
  
  const task = note.content[taskIndex];
  if (task.type === 'task' && task.comment) {
    // Add the number of lines in the comment
    endLine += task.comment.split('\n').length;
  }
  
  return { start: startLine, end: endLine };
}

/**
 * Find tasks in a note and calculate their line ranges (including comments)
 * @param note The parsed note
 * @param tasks Array of tasks to find
 * @returns Array of line ranges for the found tasks
 */
export function findTaskLineRanges(note: Note, tasks: Task[]): Array<{ start: number; end: number }> {
  const lineRanges: Array<{ start: number; end: number }> = [];
  
  for (const task of tasks) {
    for (let i = 0; i < note.content.length; i++) {
      const node = note.content[i];
      if (node.type === 'task' && 
          node.todoText === task.todoText && 
          node.status === task.status) {
        lineRanges.push(calculateTaskLineRange(note, i));
        break;
      }
    }
  }
  
  return lineRanges;
}

/**
 * Create a navigation target from line ranges
 * @param filePath The file path
 * @param lineRanges Array of line ranges
 * @param description Description for the navigation target
 * @returns NavigationTarget object
 */
export function createNavigationTargetFromRanges(
  filePath: string, 
  lineRanges: Array<{ start: number; end: number }>, 
  description: string
): NavigationTarget {
  if (lineRanges.length === 0) {
    // Default to line 1 if no line ranges provided
    return {
      filePath,
      lineRange: { start: 1, end: 1 },
      description
    };
  }
  
  // If single task, use its exact range
  if (lineRanges.length === 1) {
    return {
      filePath,
      lineRange: lineRanges[0],
      description
    };
  }
  
  // For multiple tasks, span from the start of the first to the end of the last
  return {
    filePath,
    lineRange: { 
      start: Math.min(...lineRanges.map(r => r.start)), 
      end: Math.max(...lineRanges.map(r => r.end)) 
    },
    description
  };
}

/**
 * Create navigation targets for tasks that have been moved/modified
 * @param note The updated note containing the tasks
 * @param tasks Array of tasks to create navigation targets for
 * @param filePath The file path
 * @param description Description template (use {{count}} for task count)
 * @returns Array containing a single navigation target for all tasks
 */
export function createNavigationTargetsForTasks(
  note: Note,
  tasks: Task[],
  filePath: string,
  description: string
): NavigationTarget[] {
  const lineRanges = findTaskLineRanges(note, tasks);
  const finalDescription = description.replace('{{count}}', tasks.length > 1 ? 's' : '');
  
  return [createNavigationTargetFromRanges(filePath, lineRanges, finalDescription)];
}

/**
 * Find tasks in a note and calculate their line numbers
 * @param note The parsed note
 * @param tasks Array of tasks to find
 * @returns Array of line numbers for the found tasks
 * @deprecated Use findTaskLineRanges instead for proper comment highlighting
 */
export function findTaskLineNumbers(note: Note, tasks: Task[]): number[] {
  const lineNumbers: number[] = [];
  
  for (const task of tasks) {
    for (let i = 0; i < note.content.length; i++) {
      const node = note.content[i];
      if (node.type === 'task' && 
          node.todoText === task.todoText && 
          node.status === task.status) {
        lineNumbers.push(calculateLineNumberForNode(note, i));
        break;
      }
    }
  }
  
  return lineNumbers;
}

/**
 * Create a navigation target from line numbers
 * @param filePath The file path
 * @param lineNumbers Array of line numbers
 * @param description Description for the navigation target
 * @returns NavigationTarget object
 * @deprecated Use createNavigationTargetFromRanges for proper comment highlighting
 */
export function createNavigationTarget(
  filePath: string, 
  lineNumbers: number[], 
  description: string
): NavigationTarget {
  if (lineNumbers.length === 0) {
    // Default to line 1 if no line numbers provided
    return {
      filePath,
      lineRange: { start: 1, end: 1 },
      description
    };
  }
  
  return {
    filePath,
    lineRange: lineNumbers.length === 1 
      ? { start: lineNumbers[0], end: lineNumbers[0] }
      : { start: Math.min(...lineNumbers), end: Math.max(...lineNumbers) },
    description
  };
} 