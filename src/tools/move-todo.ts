import MyPlugin from "../main";
import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { ObsidianTool, NavigationTarget } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { readNote, updateNote, Note, findTaskByDescription, determineInsertionPosition } from "../utils/tools/note-utils";
import { insertTaskAtPosition, Task } from "../utils/task/task-utils";
import { moveTaskToPosition } from "../utils/task/move-task-to-position";
import { validateTasks } from "../utils/task/task-validation";
import { createNavigationTargetsForTasks, createNavigationTarget, findTaskLineNumbers } from "../utils/tools/line-number-utils";
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
  getActionText: (input: MoveTodoToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
    if (!input || typeof input !== 'object') return '';
    
    const todoCount = input.todos?.length || 0;
    let actionText = '';
    
    if (todoCount === 1) {
      actionText = `"${input.todos[0].todo_text}"`;
    } else {
      actionText = `${todoCount} todos`;
    }
    
    if (hasError) {
      return `Failed to move ${actionText}`;
    } else if (hasCompleted) {
      return `Moved ${actionText}`;
    } else if (hasStarted) {
      return `Moving ${actionText}...`;
    } else {
      return `Move ${actionText}`;
    }
  },
  execute: async (context: ToolExecutionContext<MoveTodoToolInput>): Promise<void> => {
    const { plugin, params } = context;
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
    const sourceMovedTasks: Task[] = []; // Tasks marked as moved in source
    const targetMovedTasks: Task[] = []; // Tasks added to target
    
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
        // For same document moves, track the moved task
        targetMovedTasks.push(task);
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
        
        // Track both source and target tasks
        sourceMovedTasks.push(task);
        targetMovedTasks.push(newMovedTask);
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
    
    // Calculate line numbers for navigation targets
    const navigationTargets: NavigationTarget[] = [];
    
    if (isMovingWithinSameDocument) {
      // For same document moves, find the new positions of the moved tasks
      const navigationTargetsForMoved = createNavigationTargetsForTasks(
        updatedTargetNote,
        targetMovedTasks,
        target_path,
        `Navigate to moved todo{{count}}`
      );
      navigationTargets.push(...navigationTargetsForMoved);
    } else {
      // For cross-document moves, provide navigation to both source and target
      
      // Source navigation (marked as moved)
      const sourceLineNumbers = findTaskLineNumbers(updatedSourceNote, sourceMovedTasks);
      if (sourceLineNumbers.length > 0) {
        navigationTargets.push(createNavigationTarget(
          source_path,
          sourceLineNumbers,
          `Source: marked as moved`
        ));
      }
      
      // Target navigation (new tasks)
      const targetLineNumbers = findTaskLineNumbers(updatedTargetNote, targetMovedTasks);
      if (targetLineNumbers.length > 0) {
        navigationTargets.push(createNavigationTarget(
          target_path,
          targetLineNumbers,
          `Destination: moved todo${movedTasks.length > 1 ? 's' : ''}`
        ));
      }
    }
    
    // Add navigation targets
    navigationTargets.forEach(target => context.addNavigationTarget(target));
    
    // Include positioning details in the success message
    let positionDetail = '';
    if (position === "after") {
      positionDetail = t('tools.position.after', { task: reference_todo_text || '' });
    } else if (position === "before") {
      positionDetail = t('tools.position.before', { task: reference_todo_text || '' });
    } else {
      positionDetail = t('tools.position.at', { position });
    }
    
    const tasksDescription = movedTasks.length === 1 
      ? `"${movedTasks[0]}"`
      : `${movedTasks.length} ${t('tools.tasks.plural')}`;
    
    const resultMessage = t('tools.success.move')
      .replace('{{task}}', tasksDescription)
      .replace('{{source}}', source_path)
      .replace('{{target}}', target_path)
      .replace('{{position}}', positionDetail);

    context.progress(resultMessage);
  }
};
