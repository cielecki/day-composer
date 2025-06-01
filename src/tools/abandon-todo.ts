import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
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
  getActionText: (input: AbandonTodoToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
    let actionText = '';
    if (!input || typeof input !== 'object') return '';
    const todoCount = input.todos?.length || 0;
    
    if (todoCount === 1) {
      actionText = `"${input.todos[0].todo_text}"`;
    } else {
      // Use proper pluralization based on count with static translation keys
      let translation = '';
      if (todoCount === 0) {
        translation = t('tools.tasks.count.zero', { count: todoCount });
      } else if (todoCount === 1) {
        translation = t('tools.tasks.count.one', { count: todoCount });
      } else if (todoCount % 10 >= 2 && todoCount % 10 <= 4 && (todoCount % 100 < 10 || todoCount % 100 >= 20)) {
        translation = t('tools.tasks.count.few', { count: todoCount });
      } else {
        translation = t('tools.tasks.count.many', { count: todoCount });
      }
      
      // Check if translation was successful, fallback to simple pluralization if not
      if (translation && !translation.startsWith('tools.tasks.count.')) {
        actionText = translation;
      } else {
        actionText = `${todoCount} ${t('tools.tasks.plural')}`;
      }
    }
    
    if (hasError) {
      return t('tools.actions.abandon.failed').replace('{{task}}', actionText);
    } else if (hasCompleted) {
      return t('tools.actions.abandon.success').replace('{{task}}', actionText);
    } else if (hasStarted) {
      return t('tools.actions.abandon.inProgress').replace('{{task}}', '');
    } else {
      return `Abandon ${actionText}`;
    }
  },
  execute: async (context: ToolExecutionContext<AbandonTodoToolInput>): Promise<void> => {
    const { plugin, params } = context;
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
    
    // Add navigation targets
    navigationTargets.forEach(target => context.addNavigationTarget(target));
    
    // Prepare success message
    const tasksDescription = abandonedTasks.length === 1 
      ? `"${abandonedTasks[0]}"`
      : `${abandonedTasks.length} ${t('tools.tasks.plural')}`;
    
    context.progress(t('tools.success.abandon', {
      task: tasksDescription,
      path: filePath
    }));
  }
};
