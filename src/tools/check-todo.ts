import MyPlugin from "../main";
import { getCurrentTime } from "./utils/getCurrentTime";
import { getDailyNotePath } from "./utils/getDailyNotePath";
import { appendComment, Task } from "./utils/task-utils";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { ObsidianTool, NavigationTarget, ToolExecutionResult } from "../obsidian-tools";
import { findTaskByDescription, readNote } from './utils/note-utils';
import { updateNote } from './utils/note-utils';
import { moveTaskToPosition } from "./utils/moveTaskToPosition";
import { validateTasks } from "./utils/task-validation";
import { createNavigationTargetsForTasks } from "./utils/line-number-utils";
import { t } from "../i18n";


const schema = {
  name: "check_todo",
  description: "Marks one or more to-do items as completed in the specified file (defaults to today's daily note)",
  input_schema: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description: "Array of to-do items to mark as completed",
        items: {
          type: "object",
          properties: {
            todo_text: {
              type: "string",
              description: "The exact text of the to-do item to mark as completed"
            },
            comment: {
              type: "string",
              description: "Optional comment to add when completing the task"
            }
          },
          required: ["todo_text"]
        }
      },
      file_path: {
        type: "string",
        description: "Optional file path (defaults to today's daily note if not provided)"
      },
      time: {
        type: "string",
        description: "Optional time to record when the task was completed (e.g., '2:30 PM')"
      }
    },
    required: ["todos"]
  }
};

type CheckTodoToolInput = {
  todos: Array<{
    todo_text: string;
    comment?: string;
  }>;
  file_path?: string;
  time?: string;
}

export const checkTodoTool: ObsidianTool<CheckTodoToolInput> = {
  specification: schema,
  icon: "check-circle",
  getActionText: (input: CheckTodoToolInput, output: string, hasResult: boolean, hasError: boolean) => {
    if (!input || typeof input !== 'object' || !input.todos) {
      return hasResult ? 'Checked todos' : 'Checking todos...';
    }

    const count = input.todos.length;
    const todoText = count === 1 ? input.todos[0].todo_text : `${count} todos`;

    if (hasResult) {
      return hasError 
        ? `Failed to check ${todoText}`
        : `Checked ${todoText}`;
    } else {
      return `Checking ${todoText}...`;
    }
  },
  execute: async (plugin: MyPlugin, params: CheckTodoToolInput): Promise<ToolExecutionResult> => {
    const { todos, time } = params;
    
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
      throw new ToolExecutionError("No to-do items provided");
    }

    // Format the current time if provided (common for all tasks)
    const currentTime = getCurrentTime(time);
    
    const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);
    const note = await readNote({plugin, filePath});
    
    // Use the validation utility to check all tasks upfront - will throw if validation fails
    // Tasks must be in pending state to be checked off
    validateTasks(
      note, 
      todos.map(todo => ({
        todoText: todo.todo_text,
        taskPredicate: (task) => task.status === 'pending'
      }))
    );
    
    // If we get here, all tasks were validated successfully
    let updatedNote = JSON.parse(JSON.stringify(note));
    const checkedTasks: string[] = [];
    const movedTasks: Task[] = []; // Store references to the moved tasks
    
    // Process all tasks (we know they're all valid at this point)
    for (const todo of todos) {
      const { todo_text, comment } = todo;
      
      // We already validated tasks, so we can directly find and process them
      const task = findTaskByDescription(updatedNote, todo_text, (task) => task.status === 'pending');
      
      // Update status (common for all tasks)
      task.status = 'completed';
      
      // Add completion time to the todo text if provided
      if (currentTime) {
        task.todoText = `${task.todoText}${t('tasks.format.completedAt', { time: currentTime })}`;
      }
      
      // Add comment if provided
      if (comment) {
        appendComment(task, comment);
      }
      
      // Move the completed task to the current position (unified logic with abandon-todo and move-todo)
      updatedNote = moveTaskToPosition(updatedNote, task);
      
      // Store the task reference for finding its new position later
      movedTasks.push(task);
      checkedTasks.push(todo_text);
    }
    
    // Update the note with all completed tasks
    await updateNote({plugin, filePath, updatedNote});
    
    // Create navigation targets for the moved tasks
    const navigationTargets = createNavigationTargetsForTasks(
      updatedNote,
      movedTasks,
      filePath,
      `Navigate to checked todo{{count}}`
    );

    // Create result message
    const resultMessage = checkedTasks.length === 1 
      ? `✅ Checked off: "${checkedTasks[0]}"`
      : `✅ Checked off ${checkedTasks.length} todos:\n${checkedTasks.map(task => `• ${task}`).join('\n')}`;

    return {
      result: resultMessage,
      navigationTargets: navigationTargets
    };
  }
};

