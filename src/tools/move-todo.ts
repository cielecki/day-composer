import MyPlugin from "../main";
import { createFile } from "./utils/createFile";
import { fileExists } from "./utils/fileExists";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { ObsidianTool } from "../obsidian-tools";
import { readNote, updateNote, Note, findTaskByDescription, determineInsertionPosition } from "./utils/note-utils";
import { insertTaskAtPosition, Task } from "./utils/task-utils";
import { moveTaskToPosition } from "./utils/moveTaskToPosition";
import { validateTasks } from "./utils/task-validation";
import { t } from "../i18n";

const schema = {
  name: "move_todo",
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

type MoveTodoToolInput = {
  todos: TodoItem[],
  source_path: string,
  target_path: string,
  position: "beginning" | "end" | "before" | "after",
  reference_todo_text?: string
}

export const moveTodoTool: ObsidianTool<MoveTodoToolInput> = {
  specification: schema,
  icon: "move",
  getActionText: (input: MoveTodoToolInput, output: string, hasResult: boolean, hasError: boolean) => {
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
        ? t('tools.actions.move.failed').replace('{{task}}', actionText)
        : t('tools.actions.move.success').replace('{{task}}', actionText);
    } else {
      // For in-progress operations, don't show task details
      return t('tools.actions.move.inProgress').replace('{{task}}', '');
    }
  },
  execute: async (plugin: MyPlugin, params: MoveTodoToolInput): Promise<string> => {
    // Extract parameters
    const { todos, source_path, position, reference_todo_text, target_path } = params;
    
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
      throw new ToolExecutionError("No to-do items provided");
    }
  
    // Make sure source file exists
    const sourceExists = await fileExists(source_path, plugin.app);
    if (!sourceExists) {
      throw new ToolExecutionError(t('errors.files.sourceNotFound', { path: source_path }));
    }
    
    // Check if target file exists, create it if not
    const targetExists = await fileExists(target_path, plugin.app);
    if (!targetExists) {
      try {
        await createFile(target_path, '', plugin.app);
      } catch (error) {
        throw new ToolExecutionError(t('errors.files.createFailed', {
          path: target_path,
          error: error.message
        }));
      }
    }
    
    // Read the source note
    const sourceNote = await readNote({plugin, filePath: source_path});
    
    // Check if moving within the same document
    const isMovingWithinSameDocument = source_path === target_path;
    
    // Read the target note (if different from source)
    const targetNote = isMovingWithinSameDocument 
      ? JSON.parse(JSON.stringify(sourceNote)) // Deep copy to avoid reference issues
      : await readNote({plugin, filePath: target_path});
    
    // Validate all tasks upfront - will throw if any validation fails
    validateTasks(
      sourceNote,
      todos.map(todo => ({
        todoText: todo.todo_text
      }))
    );
    
    // Check if the reference_todo_text is specified and exists when position is 'before' or 'after'
    if ((position === "before" || position === "after") && reference_todo_text) {
      const referenceTask = findTaskByDescription(targetNote, reference_todo_text, (task) => true);
      
      if (!referenceTask) {
        throw new ToolExecutionError(t('errors.tasks.notFound', {
          task: `"${reference_todo_text}"`,
          path: target_path
        }));
      }
    }
    
    // Track tasks that will be moved
    const movedTasks: string[] = [];
    
    // Get source and target names for reference (use basename or just the path)
    const sourceName = source_path.split('/').pop()?.replace('.md', '') || source_path;
    const targetName = target_path.split('/').pop()?.replace('.md', '') || target_path;
    
    let updatedSourceNote = JSON.parse(JSON.stringify(sourceNote)) as Note;
    let updatedTargetNote = isMovingWithinSameDocument 
      ? updatedSourceNote
      : JSON.parse(JSON.stringify(targetNote)) as Note;
    
    function processTodo(todo: TodoItem) {
      const todoText = todo.todo_text;
      
      // We already validated that all tasks exist
      const task = findTaskByDescription(updatedSourceNote, todoText, (task) => true);
      
      // Handle moving based on whether it's within the same document or to another document
      if (isMovingWithinSameDocument) {
        updatedSourceNote = moveTaskToPosition(updatedSourceNote, task, position, reference_todo_text);
        updatedTargetNote = updatedSourceNote;
      } else {
        // Create the task for the target document
        const newMovedTask: Task = JSON.parse(JSON.stringify(task));
        
        // Reset status to original (pending or completed)
        // But mark the source
        newMovedTask.status = task.status === 'moved' ? 'pending' : task.status;
        
        if (sourceName) {
          newMovedTask.todoText += t('tasks.format.movedFrom', { source: sourceName });
        }
        
        // Mark the task as moved in the source note
        task.status = 'moved';

        if (targetName) {
          task.todoText += t('tasks.format.movedTo', { target: targetName });
        }
        
        // Determine insertion position in target note based on positioning strategy
        const insertionIndex = determineInsertionPosition(
          updatedTargetNote,
          position,
          reference_todo_text
        );
        
        // Add the moved task to the target note at the determined position
        updatedTargetNote = insertTaskAtPosition(updatedTargetNote, newMovedTask, insertionIndex);
      }
      
      movedTasks.push(todoText);
    }

    if (position === "before" || position === "end") {
      // Process in normal order for "before" or "end" positions
      for (const todo of todos) {
        processTodo(todo);
      }
    } else {
      // Process in reverse order for all other positions
      for (let i = todos.length - 1; i >= 0; i--) {
        const todo = todos[i];
        processTodo(todo);
      }
    }
    
    // Update the files with all the changes
    if (isMovingWithinSameDocument) {
      await updateNote({plugin, filePath: source_path, updatedNote: updatedSourceNote});
    } else {
      await updateNote({plugin, filePath: source_path, updatedNote: updatedSourceNote});
      await updateNote({plugin, filePath: target_path, updatedNote: updatedTargetNote});
    }
    
    // Include positioning details in the success message
    const positionDetail = (position === "after" || position === "before")
      ? t(`tools.position.${position}`).replace('{{task}}', reference_todo_text || '')
      : t('tools.position.at').replace('{{position}}', position);
    
    const tasksDescription = movedTasks.length === 1 
      ? `"${movedTasks[0]}"`
      : `${movedTasks.length} ${t('tools.tasks.plural')}`;
    
    return t('tools.success.move')
      .replace('{{task}}', tasksDescription)
      .replace('{{source}}', source_path)
      .replace('{{target}}', target_path)
      .replace('{{position}}', positionDetail);
  }
};
