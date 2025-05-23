import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";
import { findTaskByDescription, updateNote } from './utils/note-utils';
import { readNote } from './utils/note-utils';
import { getDailyNotePath } from "./utils/getDailyNotePath";
import { appendCommentLine } from "./utils/task-utils";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { validateTasks } from "./utils/task-validation";
import { findCurrentSpot } from "./utils/note-utils";
import { removeTaskFromDocument, insertTaskAtPosition } from "./utils/task-utils";
import { t } from "../i18n";

const schema = {
  name: "abandon_todo",
  description: "Marks one or more to-do items as abandoned / skipped in a specified document or today's daily note",
  input_schema: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description: "Array of to-do items to abandon",
        items: {
          type: "object",
          properties: {
            todo_text: {
              type: "string",
              description: "The exact text of the to-do item to abandon",
            },
            comment: {
              type: "string",
              description: "The comment explaining why the task is being abandoned, will be added below the task",
            },
          },
          required: ["todo_text"]
        }
      },
      file_path: {
        type: "string",
        description: "The path of the document containing the to-dos (including .md extension). If not provided, searches only in today's daily note.",
      }
    },
    required: ["todos"]
  }
};

type TodoItem = {
  todo_text: string,
  comment?: string
}

type AbandonTodoToolInput = {
  todos: TodoItem[],
  file_path?: string
}

export const abandonTodoTool: ObsidianTool<AbandonTodoToolInput> = {
  specification: schema,
  icon: "x-square",
  getActionText: (input: AbandonTodoToolInput, output: string, hasResult: boolean, hasError: boolean) => {
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
        ? t('tools.actions.abandon.failed').replace('{{task}}', actionText)
        : t('tools.actions.abandon.success').replace('{{task}}', actionText);
    } else {
      // For in-progress operations, don't show task details
      return t('tools.actions.abandon.inProgress').replace('{{task}}', '');
    }
  },
  execute: async (plugin: MyPlugin, params: AbandonTodoToolInput): Promise<string> => {
    const { todos } = params;
    
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
      throw new ToolExecutionError("No to-do items provided");
    }
    
    const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);
    const note = await readNote({plugin, filePath});
    
    // Validate all tasks upfront - will throw if any validation fails
    validateTasks(
      note,
      todos
    );
    
    // Track tasks that will be abandoned
    const abandonedTasks: string[] = [];
    
    // If we get here, all tasks were validated successfully
    let updatedNote = JSON.parse(JSON.stringify(note));
    
    // Process each to-do item
    for (const todo of todos) {
      const { todo_text, comment } = todo;
      
      // We already validated all tasks exist
      const task = findTaskByDescription(updatedNote, todo_text);
      
      // Update status
      task.status = 'abandoned';
      
      // Add comment if provided
      if (comment) {
        appendCommentLine(task, comment);
      }
      
      // Remove the task from its current position
      updatedNote = removeTaskFromDocument(updatedNote, task);
      
      // Find the current position (first pending task or end of document)
      const currentSpot = findCurrentSpot(updatedNote);
      
      // Insert the abandoned task at the current position
      updatedNote = insertTaskAtPosition(updatedNote, task, currentSpot);
      
      abandonedTasks.push(todo_text);
    }
    
    // Update the note with all abandoned tasks
    await updateNote({plugin, filePath, updatedNote});
    
    // Prepare success message
    const tasksDescription = abandonedTasks.length === 1 
      ? `"${abandonedTasks[0]}"`
      : `${abandonedTasks.length} ${t('tools.tasks.plural')}`;
      
    return t('tools.success.abandon')
      .replace('{{task}}', tasksDescription)
      .replace('{{path}}', filePath);
  }
};
