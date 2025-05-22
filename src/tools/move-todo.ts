import MyPlugin from "../main";
import { createFile } from "./utils/createFile";
import { fileExists } from "./utils/fileExists";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { ObsidianTool } from "../obsidian-tools";
import { readNote, updateNote, Note, determineInsertionPosition, findTaskByDescription } from "./utils/note-utils";
import { createMovedTask, markTaskAsMoved, insertTaskAtPosition, removeTaskFromDocument } from "./utils/task-utils";
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
              description: "The text of the to-do item to move (without the checkbox markers)",
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
					"Where to place the moved to-do items: 'beginning' (at the start of the document, after all done items), 'end' (at the end of the document), or 'after' (after a specific to-do)",
				enum: ["beginning", "end", "after"],
			},
			after_todo_text: {
				type: "string",
				description:
					"When position is 'after', this is the description of the to-do item after which the new items should be placed.",
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
  position: "beginning" | "end" | "after",
  after_todo_text?: string
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
    const { todos, source_path, position, after_todo_text, target_path } = params;
    
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
      throw new ToolExecutionError("No to-do items provided");
    }
  
    // Make sure source file exists
    const sourceExists = await fileExists(source_path, plugin.app);
    if (!sourceExists) {
      throw new ToolExecutionError(t('errors.files.sourceNotFound').replace('{{path}}', source_path));
    }
    
    // Check if target file exists, create it if not
    const targetExists = await fileExists(target_path, plugin.app);
    if (!targetExists) {
      try {
        await createFile(target_path, '', plugin.app);
      } catch (error) {
        throw new ToolExecutionError(t('errors.files.createFailed')
          .replace('{{path}}', target_path)
          .replace('{{error}}', error.message));
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
      todos
    );
    
    // Check if the after_todo_text is specified and exists when position is 'after'
    if (position === "after" && after_todo_text) {
      const referenceTask = findTaskByDescription(targetNote, after_todo_text);
      
      if (!referenceTask) {
        throw new ToolExecutionError(t('errors.tasks.notFound')
          .replace('{{task}}', `"${after_todo_text}"`)
          .replace('{{file}}', target_path));
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
    
    // Process each to-do item
    for (const todo of todos) {
      const todoText = todo.todo_text;
      
      // We already validated that all tasks exist
      const task = findTaskByDescription(sourceNote, todoText);
      
      // Handle moving based on whether it's within the same document or to another document
      if (isMovingWithinSameDocument) {
        // Remove the task from its current position
        updatedSourceNote = removeTaskFromDocument(updatedSourceNote, task);
        
        // Determine insertion position in the document
        const insertionIndex = determineInsertionPosition(
          updatedSourceNote,
          position,
          after_todo_text
        );
        
        // Insert the task at the new position
        updatedSourceNote = insertTaskAtPosition(updatedSourceNote, task, insertionIndex);
        updatedTargetNote = updatedSourceNote; // Keep them in sync
      } else {
        // Mark the task as moved in the source note
        const updatedTask = markTaskAsMoved(task, targetName);
        
        // Create the task for the target document
        const movedTask = createMovedTask(task, sourceName);
        
        // Replace the task with the moved task reference in the source
        for (let i = 0; i < updatedSourceNote.content.length; i++) {
          const node = updatedSourceNote.content[i];
          if (node.type === 'task' && node.description === task.description) {
            updatedSourceNote.content[i] = updatedTask;
            break;
          }
        }
        
        // Determine insertion position in target note based on positioning strategy
        const insertionIndex = determineInsertionPosition(
          updatedTargetNote,
          position,
          after_todo_text
        );
        
        // Add the moved task to the target note at the determined position
        updatedTargetNote = insertTaskAtPosition(updatedTargetNote, movedTask, insertionIndex);
      }
      
      movedTasks.push(todoText);
    }
    
    // Update the files with all the changes
    if (isMovingWithinSameDocument) {
      await updateNote({plugin, filePath: source_path, updatedNote: updatedSourceNote});
    } else {
      await updateNote({plugin, filePath: source_path, updatedNote: updatedSourceNote});
      await updateNote({plugin, filePath: target_path, updatedNote: updatedTargetNote});
    }
    
    // Include positioning details in the success message
    const positionDetail = position === "after"
      ? t('tools.position.after').replace('{{task}}', after_todo_text || '')
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
