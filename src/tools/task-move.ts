import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { ObsidianTool } from 'src/obsidian-tools';
import { ToolExecutionContext } from 'src/types/chat-types';
import { readNote, updateNote, determineInsertionPosition } from 'src/utils/tools/note-utils';
import { insertTaskAtPosition, Task, removeTaskFromDocument } from 'src/utils/tasks/task-utils';
import { validateTasks } from 'src/utils/tasks/task-validation';
import { createNavigationTargetsForTasks, createNavigationTarget, findTaskLineNumbers } from 'src/utils/tools/line-number-utils';
import { t } from 'src/i18n';
import { findTaskByDescription } from "src/utils/tools/note-utils";

const schema = {
  name: "task_move",
  description: "Moves one or more to-do items within the same document or from one document to another",
  input_schema: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description: "Array of to-do items to move",
        items: {
          type: "object",
          properties: {
            todo_text: {
              type: "string",
              description: "The complete text of the to-do item to move. This should include all formatting, emojis, time markers, and any other specific formatting.",
            }
          },
          required: ["todo_text"]
        }
      },
      source_path: {
        type: "string",
        description: "The path of the source document containing the to-dos (including .md extension).",
      },
      target_path: {
				type: "string",
				description:
					"The path of the document to move the to-do items to (including .md extension). Can be the same as source_path to move within a document.",
			},
			position: {
				type: "string",
				description:
					"Where to place the moved to-do items: 'beginning' (at the start of the document, after all done items), 'end' (at the end of the document), 'before' (before a specific to-do), or 'after' (after a specific to-do)",
				enum: ["beginning", "end", "before", "after"],
			},
			reference_todo_text: {
				type: "string",
				description:
					"When position is 'before' or 'after', this is the complete text of the reference to-do item for positioning.",
			},
    },
    required: ["todos", "source_path", "target_path", "position"]
  }
};

type TodoItem = {
  todo_text: string
}

type TaskMoveToolInput = {
  todos: TodoItem[],
  source_path: string,
  target_path: string,
  position: "beginning" | "end" | "before" | "after",
  reference_todo_text?: string
}

export const taskMoveTool: ObsidianTool<TaskMoveToolInput> = {
  specification: schema,
  icon: "move",
  get initialLabel() {
    return t('tools.move.label');
  },
  execute: async (context: ToolExecutionContext<TaskMoveToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { todos, position, reference_todo_text } = params;
    
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
      context.setLabel(t('tools.actions.move.failed', { task: '' }));
      throw new ToolExecutionError("No to-do items provided");
    }

    const count = todos.length;
    const todoText = count === 1 ? todos[0].todo_text : `${count} todos`;
    
    context.setLabel(t('tools.actions.move.inProgress', { task: todoText }));

    const filePath = params.source_path;
    const targetFilePath = params.target_path;
    
    try {
      const note = await readNote({plugin, filePath});
      
      // Validate all tasks upfront - will throw if any validation fails
      validateTasks(
        note,
        todos.map(todo => ({ todoText: todo.todo_text }))
      );
      
      // Track tasks that will be moved
      const movedTasks: Task[] = [];
      
      // If we get here, all tasks were validated successfully
      let updatedNote = JSON.parse(JSON.stringify(note));
      
      // Find all the tasks to move and remove them from the document first
      for (const todo of todos) {
        const task = findTaskByDescription(updatedNote, todo.todo_text, (task) => true);
        updatedNote = removeTaskFromDocument(updatedNote, task);
        movedTasks.push(task);
      }
      
      // If moving to different file, load target note
      let targetNote = updatedNote;
      if (targetFilePath !== filePath) {
        // Check if target file exists, create if it doesn't
        const targetExists = await fileExists(targetFilePath, plugin.app);
        if (!targetExists) {
          await createFile(targetFilePath, "", plugin.app);
        }
        targetNote = await readNote({plugin, filePath: targetFilePath});
      }
      
      // Determine insertion position in target note
      const insertionIndex = determineInsertionPosition(
        targetNote,
        position,
        reference_todo_text,
      );
      
      // Insert all moved tasks at the target position
      for (let i = 0; i < movedTasks.length; i++) {
        const task = movedTasks[i];
        
        // Insert at the calculated position + i to maintain order
        targetNote = insertTaskAtPosition(
          targetNote,
          task,
          insertionIndex + i,
        );
      }
      
      // Update both notes if they're different
      if (targetFilePath !== filePath) {
        await updateNote({plugin, filePath, updatedNote});
        await updateNote({plugin, filePath: targetFilePath, updatedNote: targetNote});
      } else {
        await updateNote({plugin, filePath, updatedNote: targetNote});
      }
      
      // Create navigation targets for the moved tasks
      const navigationTargets = createNavigationTargetsForTasks(
        targetNote,
        movedTasks,
        targetFilePath,
        `Navigate to moved todo{{count}}`
      );
      
      // Add navigation targets
      navigationTargets.forEach(target => context.addNavigationTarget(target));
      
      // Prepare success message
      const tasksDescription = todos.length === 1 
        ? `"${todos[0].todo_text}"` 
        : `${todos.length} ${t('tools.tasks.plural')}`;
        
      context.setLabel(t('tools.actions.move.success', { task: todoText }));
      context.progress(t('tools.success.move', {
        task: tasksDescription,
        position,
        path: targetFilePath
      }));
    } catch (error) {
      context.setLabel(t('tools.actions.move.failed', { task: todoText }));
      throw error;
    }
  }
};
