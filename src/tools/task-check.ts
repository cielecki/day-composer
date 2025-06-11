import { getCurrentTime } from "../utils/time/get-current-time";
import { getDailyNotePath } from "../utils/daily-notes/get-daily-note-path";
import { appendComment, Task } from 'src/utils/tasks/task-utils';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { ObsidianTool } from 'src/obsidian-tools';
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { readNote, updateNote } from 'src/utils/tools/note-utils';
import { moveTaskToPosition } from 'src/utils/tasks/move-task-to-position';
import { validateTasks } from 'src/utils/tasks/task-validation';
import { createNavigationTargetsForTasks } from 'src/utils/tools/line-number-utils';
import { t } from 'src/i18n';
import { findTaskByDescription } from "src/utils/tools/note-utils";


const schema = {
  name: "task_check",
  description: "Marks one or more to-do items as completed in the specified file (defaults to today's daily note)",
  input_schema: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description: "Array of to-do items to mark as completed",
        items: {
          type: "object",
          properties: {
            todo_text: {
              type: "string",
              description: "The exact text of the to-do item to mark as completed"
            },
            comment: {
              type: "string",
              description: "Optional comment to add when completing the task"
            }
          },
          required: ["todo_text"]
        }
      },
      file_path: {
        type: "string",
        description: "Optional file path (defaults to today's daily note if not provided)"
      },
      time: {
        type: "string",
        description: "Optional time to record when the task was completed (e.g., '2:30 PM')"
      }
    },
    required: ["todos"]
  }
};

type TaskCheckToolInput = {
  todos: Array<{
    todo_text: string;
    comment?: string;
  }>;
  file_path?: string;
  time?: string;
}

export const taskCheckTool: ObsidianTool<TaskCheckToolInput> = {
  specification: schema,
  icon: "check-circle",
  sideEffects: true, // Modifies files by checking tasks
  get initialLabel() {
    return t('tools.check.labels.initial');
  },
  execute: async (context: ToolExecutionContext<TaskCheckToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { todos, time } = params;
    
    if (!todos || !Array.isArray(todos) || todos.length === 0) {
      context.setLabel(t('tools.check.labels.failed', { task: 'todos' }));
      throw new ToolExecutionError("No to-do items provided");
    }

    const count = todos.length;
    const todoText = count === 1 ? todos[0].todo_text : `${count} todos`;
    
    context.setLabel(t('tools.check.labels.inProgress', { task: todoText }));

    // Format the current time if provided (common for all tasks)
    const currentTime = getCurrentTime(time);
    
    const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);
    
    try {
      const note = await readNote({plugin, filePath});
      
      // Use the validation utility to check all tasks upfront - will throw if validation fails
      // Tasks must be in pending state to be checked off
      validateTasks(
        note, 
        todos.map(todo => ({
          todoText: todo.todo_text,
          taskPredicate: (task) => task.status === 'pending'
        }))
      );
      
      // If we get here, all tasks were validated successfully
      let updatedNote = JSON.parse(JSON.stringify(note));
      const checkedTasks: string[] = [];
      const movedTasks: Task[] = []; // Store references to the moved tasks
      
      // Process all tasks (we know they're all valid at this point)
      for (const todo of todos) {
        const { todo_text, comment } = todo;
        
        // We already validated tasks, so we can directly find and process them
        const task = findTaskByDescription(updatedNote, todo_text, (task) => task.status === 'pending');
        
        // Update status (common for all tasks)
        task.status = 'completed';
        
        // Add completion time to the todo text if provided
        if (currentTime) {
          task.todoText = `${task.todoText}${t('tasks.format.completedAt', { time: currentTime })}`;
        }
        
        // Add comment if provided
        if (comment) {
          appendComment(task, comment);
        }
        
        // Move the completed task to the current position (unified logic with abandon-todo and move-todo)
        updatedNote = moveTaskToPosition(updatedNote, task);
        
        // Store the task reference for finding its new position later
        movedTasks.push(task);
        checkedTasks.push(todo_text);
      }
      
      // Update the note with all completed tasks
      await updateNote({plugin, filePath, updatedNote});
      
      // Create navigation targets for the moved tasks
      const navigationTargets = createNavigationTargetsForTasks(
        updatedNote,
        movedTasks,
        filePath
      );

      // Add navigation targets
      navigationTargets.forEach(target => context.addNavigationTarget(target));

      // Create result message
      const resultMessage = checkedTasks.length === 1 
        ? `✅ Checked off: "${checkedTasks[0]}"` 
        : `✅ Checked off ${checkedTasks.length} todos:\n${checkedTasks.map(task => `• ${task}`).join('\n')}`;

      context.setLabel(t('tools.check.labels.success', { task: todoText }));
      context.progress(resultMessage);
    } catch (error) {
      context.setLabel(t('tools.check.labels.failed', { task: todoText }));
      throw error;
    }
  }
};

