import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";
import { findTaskByDescription, updateNote, readNote, NoteNode, TextBlock } from './utils/note-utils';
import { getDailyNotePath } from "./utils/getDailyNotePath";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { validateTasks } from "./utils/task-validation";
import { removeTaskFromDocument, formatTask } from "./utils/task-utils";
import { t } from "../i18n";

const schema = {
  name: "remove_todo",
  description: "Removes one or more to-do items by converting them to comment blocks indicating they have been removed",
  input_schema: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description: "Array of to-do items to remove",
        items: {
          type: "object",
          properties: {
            todo_text: {
              type: "string",
              description: "The complete text of the to-do item to remove. This should include all formatting, emojis, time markers, and any other specific formatting.",
            },
            removal_reason: {
              type: "string",
              description: "Optional reason for removing the task. Will be included in the removal comment.",
            }
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
  todo_text: string;
  removal_reason?: string;
};

type RemoveTodoToolInput = {
  todos: TodoItem[];
  file_path?: string;
};

export const removeTodoTool: ObsidianTool<RemoveTodoToolInput> = {
  specification: schema,
  icon: "trash-2",
  getActionText: (input: RemoveTodoToolInput, output: string, hasResult: boolean, hasError: boolean) => {
    if (hasResult) {
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
        ? t('tools.actions.remove.failed').replace('{{task}}', actionText)
        : t('tools.actions.remove.success').replace('{{task}}', actionText);
    } else {
      return t('tools.actions.remove.inProgress').replace('{{task}}', '');
    }
  },
  execute: async (plugin: MyPlugin, params: RemoveTodoToolInput): Promise<string> => {
    const { todos } = params;
    
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
      throw new ToolExecutionError("No to-do items provided");
    }
    
    const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);
    const note = await readNote({plugin, filePath});
    
    // Validate all tasks upfront - will throw if any validation fails
    validateTasks(
      note,
      todos.map(todo => ({
        todoText: todo.todo_text
      }))
    );
    
    // Track tasks that will be removed
    const removedTasks: string[] = [];
    
    // If we get here, all tasks were validated successfully
    let updatedNote = JSON.parse(JSON.stringify(note));
    
    // Process each to-do item
    for (const todo of todos) {
      const { todo_text, removal_reason } = todo;
      
      // Find the task to remove
      const taskToRemove = findTaskByDescription(updatedNote, todo_text, (task) => true);
      
      // Get the original position to insert the comment block
      const originalPosition = updatedNote.content.findIndex((node: NoteNode) => 
        node.type === 'task' && 
        node.todoText === taskToRemove.todoText && 
        node.status === taskToRemove.status
      );
      
      // Remove the task from the document
      updatedNote = removeTaskFromDocument(updatedNote, taskToRemove);
      
      // Create the comment block with the removed task information
      const originalTaskText = formatTask(taskToRemove);
      const reasonText = removal_reason ? ` (Reason: ${removal_reason})` : '';
      const removalComment = `<!-- REMOVED TASK: This task has been removed${reasonText}
${originalTaskText}
-->`;
      
      // Create a text block for the removal comment
      const commentBlock: TextBlock = {
        type: 'text',
        content: removalComment,
        lineIndex: -1
      };
      
      // Insert the comment block at the original position
      updatedNote.content.splice(originalPosition, 0, commentBlock);
      
      removedTasks.push(todo_text);
    }
    
    // Update the note with all removals
    await updateNote({plugin, filePath, updatedNote});
    
    // Prepare success message
    const tasksDescription = removedTasks.length === 1 
      ? `"${removedTasks[0]}"`
      : `${removedTasks.length} ${t('tools.tasks.plural')}`;
      
    return t('tools.success.remove')
      .replace('{{task}}', tasksDescription)
      .replace('{{path}}', filePath);
  }
}; 