import MyPlugin from "../main";
import { ObsidianTool, NavigationTarget, ToolExecutionResult } from "../obsidian-tools";
import { findTaskByDescription, updateNote, readNote } from "../utils/tools/note-utils";
import { getDailyNotePath } from "../utils/daily-notes/get-daily-note-path";
import { getCurrentTime } from "../utils/time/get-current-time";
import { appendComment, Task } from "../utils/task/task-utils";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { validateTasks } from "../utils/task/task-validation";
import { moveTaskToPosition } from "../utils/task/move-task-to-position";
import { createNavigationTargetsForTasks } from "../utils/tools/line-number-utils";
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
              description: "The complete text of the to-do item to abandon. This should include all formatting, emojis, time markers, and any other specific formatting.",
            },
            comment: {
              type: "string",
              description: "The comment explaining why the task is being abandoned, will be added below the task",
            },
          },
          required: ["todo_text"]
        }
      },
      time: {
        type: "string",
        description: "Time when the tasks were abandoned in HH:MM format. If not provided, current time will be used. This time is applied to all tasks in the batch.",
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
  time?: string,
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
  execute: async (plugin: MyPlugin, params: AbandonTodoToolInput): Promise<ToolExecutionResult> => {
    const { todos, time } = params;
    
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
      throw new ToolExecutionError("No to-do items provided");
    }
    
    // Format the current time if provided (common for all tasks)
    const currentTime = getCurrentTime(time);
    
    const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);
    const note = await readNote({plugin, filePath});
    
    // Validate all tasks upfront - will throw if any validation fails
    validateTasks(
      note,
      todos.map(todo => ({
        todoText: todo.todo_text,
        taskPredicate: (task) => task.status !== 'abandoned'
      }))
    );
    
    // Track tasks that will be abandoned
    const abandonedTasks: string[] = [];
    const movedTasks: Task[] = []; // Store references to the moved tasks
    
    // If we get here, all tasks were validated successfully
    let updatedNote = JSON.parse(JSON.stringify(note));
    
    // Process each to-do item
    for (const todo of todos) {
      const { todo_text, comment } = todo;
      
      // We already validated all tasks exist
      const task = findTaskByDescription(updatedNote, todo_text, (task) => task.status !== 'abandoned');
      
      // Update status
      task.status = 'abandoned';
      
      // Add abandonment time to the todo text if provided
      if (currentTime) {
        task.todoText = `${task.todoText}${t('tasks.format.abandonedAt', { time: currentTime })}`;
      }
      
      // Add comment if provided
      if (comment) {
        appendComment(task, comment);
      }
      
      // Move the abandoned task to the current position (unified logic with check-todo and move-todo)
      updatedNote = moveTaskToPosition(updatedNote, task);
      
      // Store the task reference for finding its new position later
      movedTasks.push(task);
      abandonedTasks.push(todo_text);
    }
    
    // Update the note with all abandoned tasks
    await updateNote({plugin, filePath, updatedNote});
    
    // Create navigation targets for the moved tasks
    const navigationTargets = createNavigationTargetsForTasks(
      updatedNote,
      movedTasks,
      filePath,
      `Navigate to abandoned todo{{count}}`
    );
    
    // Prepare success message
    const tasksDescription = abandonedTasks.length === 1 
      ? `"${abandonedTasks[0]}"`
      : `${abandonedTasks.length} ${t('tools.tasks.plural')}`;
      
    const resultMessage = t('tools.success.abandon')
      .replace('{{task}}', tasksDescription)
      .replace('{{path}}', filePath);

    return {
      result: resultMessage,
      navigationTargets: navigationTargets
    };
  }
};
