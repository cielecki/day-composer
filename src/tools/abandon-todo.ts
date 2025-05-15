import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";
import { findTaskByDescription, updateNote } from './utils/note-utils';
import { readNote } from './utils/note-utils';
import { getDailyNotePath } from "./utils/getDailyNotePath";
import { appendCommentLine } from "./utils/task-utils";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { validateTasks } from "./utils/task-validation";
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
    let actionText = '';
    if (!input || typeof input !== 'object') actionText = '';
    const todoCount = input.todos?.length || 0;
    actionText = todoCount === 1 
      ? `"${input.todos[0].todo_text}"`
      : `${todoCount} ${t('tools.tasks.plural')}`;
      
    if (hasResult) {
      return hasError
        ? t('tools.actions.abandon.failed').replace('{{task}}', actionText)
        : t('tools.actions.abandon.success').replace('{{task}}', actionText);
    } else {
      return t('tools.actions.abandon.inProgress').replace('{{task}}', actionText);
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
    
    // Process each to-do item
    for (const todo of todos) {
      const { todo_text, comment } = todo;
      
      // We already validated all tasks exist
      const task = findTaskByDescription(note, todo_text);
      
      // Update status
      task.status = 'abandoned';
      
      // Add comment if provided
      if (comment) {
        appendCommentLine(task, comment);
      }
      
      abandonedTasks.push(todo_text);
    }
    
    // Update the note with all abandoned tasks
    await updateNote({plugin, filePath, updatedNote: note});
    
    // Prepare success message
    const tasksDescription = abandonedTasks.length === 1 
      ? `"${abandonedTasks[0]}"`
      : `${abandonedTasks.length} ${t('tools.tasks.plural')}`;
      
    return t('tools.success.abandon')
      .replace('{{task}}', tasksDescription)
      .replace('{{path}}', filePath);
  }
};
