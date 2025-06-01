import { findTaskByDescription } from "../tools/note-utils";
import { ToolExecutionError } from "../tools/tool-execution-error";
import { Note } from "../tools/note-utils";
import { Task } from "../task/task-utils";

// Define a standard todo item structure
export type TaskToValidate = {
  todoText: string;
  taskPredicate?: (task: Task) => boolean;
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
  const taskErrors: string[] = [];

  // Validate all tasks first
  for (const todo of todos) {
    const todoText = todo.todoText;
    
    try {
      // Find the task - this may throw an error if not found or if multiple found
      const task = findTaskByDescription(note, todoText, todo.taskPredicate || (() => true));

      validTasks.push({todo, task});
    } catch (error) {
      // Accumulate the actual error message instead of assuming it's "not found"
      taskErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  // If any validation failed, throw a consolidated error
  if (taskErrors.length > 0) {
    const errorMessage = taskErrors.join('\n\n');
    throw new ToolExecutionError(errorMessage);
  }

  return validTasks;
};