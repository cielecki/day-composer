import MyPlugin from "../main";
import { getCurrentTime } from "./utils/getCurrentTime";
import { getDailyNotePath } from "./utils/getDailyNotePath";
import { appendComment } from "./utils/task-utils";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { ObsidianTool } from "../obsidian-tools";
import { findTaskByDescription, readNote } from './utils/note-utils';
import { findCurrentSpot } from "./utils/note-utils";
import { updateNote } from './utils/note-utils';
import { removeTaskFromDocument, insertTaskAtPosition } from "./utils/task-utils";
import { validateTasks } from "./utils/task-validation";
import { t } from "../i18n";


const schema = {
  name: "check_todo",
  description: "Checks off one or more to-do items in a specified document or today's daily note",
  input_schema: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description: "Array of to-do items to check off",
        items: {
          type: "object",
          properties: {
            todo_text: {
              type: "string",
              description: "The exact text of the to-do item to check off",
            },
            comment: {
              type: "string",
              description: "Additional contextual information or thoughts about completing this task. Will be added as an indented comment below the checked item.",
            }
          },
          required: ["todo_text"]
        }
      },
      time: {
        type: "string",
        description: "Time when the tasks were completed in HH:MM format. If not provided, current time will be used. This time is applied to all tasks in the batch.",
      },
      file_path: {
        type: "string",
        description: "The specific file to check for the to-dos (including .md extension). If not provided, searches only in today's daily note.",
      }
    },
    required: ["todos"]
  }
};

type TodoItem = {
  todo_text: string,
  comment?: string
}

type CheckTodoToolInput = {
  todos: TodoItem[],
  time?: string,
  file_path?: string
}

export const checkTodoTool: ObsidianTool<CheckTodoToolInput> = {
  specification: schema,
  icon: "check-square",
  getActionText: (input: CheckTodoToolInput, output: string, hasResult: boolean, hasError: boolean) => {
    if (hasResult) {
      // Only process task text for completed operations
      let actionText = '';
      if (!input || typeof input !== 'object') actionText = '';
      const todoCount = input.todos?.length || 0;
      
      if (todoCount === 1) {
        actionText = `"${input.todos[0].todo_text}"`;
      } else {
        // Use proper pluralization based on count
        const countKey = todoCount === 0 ? 'zero' :
                         todoCount === 1 ? 'one' :
                         todoCount % 10 >= 2 && todoCount % 10 <= 4 && (todoCount % 100 < 10 || todoCount % 100 >= 20) ? 'few' : 'many';
        
        // Check if the translation key exists
        try {
          const translation = t(`tools.tasks.count.${countKey}`, { count: todoCount });
          actionText = translation !== `tools.tasks.count.${countKey}` ? translation : `${todoCount} ${t('tools.tasks.plural')}`;
        } catch (e) {
          // Fallback to simple pluralization if the count format is not available
          actionText = `${todoCount} ${t('tools.tasks.plural')}`;
        }
      }
      
      return hasError
        ? t('tools.actions.check.failed').replace('{{task}}', actionText)
        : t('tools.actions.check.success').replace('{{task}}', actionText);
    } else {
      // For in-progress operations, don't show task details
      return t('tools.actions.check.inProgress').replace('{{task}}', '');
    }
  },
  execute: async (plugin: MyPlugin, params: CheckTodoToolInput): Promise<string> => {
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
      todos, 
      'pending'
    );
    
    // If we get here, all tasks were validated successfully
    let updatedNote = JSON.parse(JSON.stringify(note));
    const checkedTasks: string[] = [];
    
    // Process all tasks (we know they're all valid at this point)
    for (const todo of todos) {
      const { todo_text, comment } = todo;
      
      // We already validated tasks, so we can directly find and process them
      const task = findTaskByDescription(updatedNote, todo_text);
      
      // Update status and completion time (common for all tasks)
      task.status = 'completed';
      task.timeInfo.completed = currentTime;
      
      // Add comment if provided
      if (comment) {
        appendComment(task, comment);
      }
      
      // Remove the task from its current position
      updatedNote = removeTaskFromDocument(updatedNote, task);
      
      // Find the current position (first pending task or end of document)
      const currentSpot = findCurrentSpot(updatedNote);
      
      // Insert the completed task at the current position
      updatedNote = insertTaskAtPosition(updatedNote, task, currentSpot);
      
      checkedTasks.push(todo_text);
    }
    
    // Update the note with all completed tasks
    await updateNote({plugin, filePath, updatedNote});
    
    // Prepare success message
    const tasksDescription = checkedTasks.length === 1 
      ? `"${checkedTasks[0]}"`
      : `${checkedTasks.length} ${t('tools.tasks.plural')}`;
      
    return t('tools.success.check')
      .replace('{{task}}', tasksDescription)
      .replace('{{path}}', filePath)
      .replace('{{time}}', currentTime);
  }
};
