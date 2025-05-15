import { findTaskByDescription } from "./note-utils";
import { ToolExecutionError } from "./ToolExecutionError";
import { t } from "../../i18n";
import { Note } from "./note-utils";
import { Task } from "./task-utils";

// Define a standard todo item structure
export type TaskToValidate = {
  todo_text: string;
};

type ValidTaskResult = Array<{todo: TaskToValidate, task: Task}>;

/**
 * Validates a batch of tasks in a document, checking if they exist and optionally checking status
 * Throws an error if any task fails validation
 * 
 * @param note The note document to search in
 * @param todos Array of todo items to validate
 * @param requiredStatus Optional status that tasks must have to be valid (e.g., 'pending')
 * @returns Array of valid tasks with their associated task objects
 */
export const validateTasks = (
  note: Note, 
  todos: TaskToValidate[], 
  requiredStatus?: string,
): ValidTaskResult => {
  const validTasks: ValidTaskResult = [];
  const notFoundTasks: string[] = [];
  const invalidStatusTasks: string[] = [];

  // Validate all tasks first
  for (const todo of todos) {
    const todoText = todo.todo_text;
    
    try {
      // Find the task - this may throw an error if not found
      const task = findTaskByDescription(note, todoText);
      
      // If we need to validate status
      if (requiredStatus && task.status !== requiredStatus) {
        invalidStatusTasks.push(todoText);
      } else {
        // Task is valid, store it for processing
        validTasks.push({todo, task});
      }
    } catch (error) {
      // Task not found
      notFoundTasks.push(todoText);
    }
  }

  // If any validation failed, throw a consolidated error
  if (notFoundTasks.length > 0 || invalidStatusTasks.length > 0) {
    let errorMessage = '';
    
    if (notFoundTasks.length > 0) {
      const notFoundDescription = notFoundTasks.length === 1
        ? `"${notFoundTasks[0]}"`
        : `${notFoundTasks.length} tasks: ${notFoundTasks.map(t => `"${t}"`).join(', ')}`;
        
      errorMessage += t('errors.tasks.notFound')
        .replace('{{task}}', notFoundDescription)
        .replace('{{file}}', note.filePath || 'document');
    }
    
    if (invalidStatusTasks.length > 0) {
      if (errorMessage) errorMessage += '\n\n';
      
      const invalidDescription = invalidStatusTasks.length === 1
        ? `"${invalidStatusTasks[0]}"`
        : `${invalidStatusTasks.length} tasks: ${invalidStatusTasks.map(t => `"${t}"`).join(', ')}`;
        
      errorMessage += t('errors.tasks.invalidState')
        .replace('{{task}}', invalidDescription)
        .replace('{{state}}', requiredStatus || 'correct state');
    }
    
    throw new ToolExecutionError(errorMessage);
  }

  return validTasks;
};