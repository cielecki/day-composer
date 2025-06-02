import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { findTaskByDescription, updateNote, readNote, NoteNode, TextBlock } from '../utils/tools/note-utils';
import { getDailyNotePath } from "../utils/daily-notes/get-daily-note-path";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { validateTasks } from "../utils/task/task-validation";
import { removeTaskFromDocument, formatTask } from "../utils/task/task-utils";
import { calculateLineNumberForNode, createNavigationTarget } from "../utils/tools/line-number-utils";
import { t } from "../i18n";

const schema = {
  name: "task_remove",
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
};

type TaskRemoveToolInput = {
  todos: TodoItem[];
  file_path?: string;
};

export const taskRemoveTool: ObsidianTool<TaskRemoveToolInput> = {
  specification: schema,
  icon: "trash-2",
  initialLabel: t('tools.remove.label'),
  execute: async (context: ToolExecutionContext<TaskRemoveToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { todos } = params;
    
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
      context.setLabel(t('tools.actions.remove.failed', { task: '' }));
      throw new ToolExecutionError("No to-do items provided");
    }

    const count = todos.length;
    const todoText = count === 1 ? todos[0].todo_text : `${count} todos`;
    
    context.setLabel(t('tools.actions.remove.inProgress', { task: todoText }));
    
    try {
      const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);
      const note = await readNote({plugin, filePath});
      
      // Validate all tasks upfront - will throw if any validation fails
      validateTasks(
        note,
        todos.map(todo => ({
          todoText: todo.todo_text
        }))
      );
      
      // Track tasks that will be removed and comment block positions
      const removedTasks: string[] = [];
      const commentBlockPositions: number[] = [];
      
      // If we get here, all tasks were validated successfully
      let updatedNote = JSON.parse(JSON.stringify(note));
      
      // Process each to-do item
      for (const todo of todos) {
        const { todo_text } = todo;
        
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
        const removalComment = `<!-- ${t('tools.comments.removedTaskHeader')}:
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
        
        // Track the position where we inserted the comment
        commentBlockPositions.push(originalPosition);
        removedTasks.push(todo_text);
      }
      
      // Update the note with all removals
      await updateNote({plugin, filePath, updatedNote});
      
      // Calculate line numbers for the comment blocks
      const lineNumbers = commentBlockPositions.map(pos => 
        calculateLineNumberForNode(updatedNote, pos)
      );
      
      // Create navigation target
      const navigationTargets = [createNavigationTarget(
        filePath,
        lineNumbers,
        `Navigate to removed todo${removedTasks.length > 1 ? 's' : ''}`
      )];
      
      // Add navigation targets
      navigationTargets.forEach(target => context.addNavigationTarget(target));
      
      // Prepare success message
      const tasksDescription = removedTasks.length === 1 
        ? `"${removedTasks[0]}"`
        : `${removedTasks.length} ${t('tools.tasks.plural')}`;
        
      context.setLabel(t('tools.actions.remove.success', { task: todoText }));
      context.progress(t('tools.success.remove', {
        task: tasksDescription,
        path: filePath
      }));
    } catch (error) {
      context.setLabel(t('tools.actions.remove.failed', { task: todoText }));
      throw error;
    }
  }
}; 