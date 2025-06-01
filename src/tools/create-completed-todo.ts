import MyPlugin from "../main";
import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { getCurrentTime } from "../utils/time/get-current-time";
import { appendComment, insertTaskAtPosition, Task } from "../utils/task/task-utils";

import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { ObsidianTool, NavigationTarget } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { findCurrentSpot, readNote, updateNote } from "../utils/tools/note-utils";
import { getDailyNotePath } from "../utils/daily-notes/get-daily-note-path";
import { createNavigationTargetsForTasks } from "../utils/tools/line-number-utils";
import { t } from "../i18n";

const schema = {
  name: "create_completed_todo",
  description: "Creates a completed todo entry. This can be used both for recording a completion of a task that has not been planned or for storing thoughts, observations, or events in your daily log.",
  input_schema: {
    type: "object",
    properties: {
      todo_text: {
        type: "string",
        description: "The complete text of the to-do item. This should contain all formatting, emojis, time markers, and any other specific formatting you want to include. (defaults to 'Note' if not provided)",
      },
      comment: {
        type: "string",
        description: "The content to add as an indented comment below the completed todo or the contents of the note to add to your daily log",
      },
      file_path: {
        type: "string",
        description: "The path of the document to add the completed todo to (including .md extension). If not provided, adds to today's daily note.",
      },
      completion_time: {
        type: "string",
        description: "Optional completion time in HH:MM format. If not provided, current time will be used.",
      }
    },
    required: ["todo_text"]
  }
};

type CreateCompletedTodoToolInput = {
  todo_text: string,
  comment?: string,
  file_path?: string,
  completion_time?: string
}

export const createCompletedTodoTool: ObsidianTool<CreateCompletedTodoToolInput> = {
  specification: schema,
  icon: "check-square-2",
  getActionText: (input: CreateCompletedTodoToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
    if (!input || typeof input !== 'object') return '';
    
    const todoText = input.todo_text || '';
    const actionText = todoText ? `"${todoText}"` : '';
    
    if (hasError) {
      return `Failed to create completed todo ${actionText}`;
    } else if (hasCompleted) {
      return `Created completed todo ${actionText}`;
    } else if (hasStarted) {
      return `Creating completed todo ${actionText}...`;
    } else {
      return `Create completed todo ${actionText}`;
    }
  },
  execute: async (context: ToolExecutionContext<CreateCompletedTodoToolInput>): Promise<void> => {
    const { plugin, params } = context;
    try {
      
      // Use "Note" as default description if not provided
      const description = params.todo_text || "Note";
      
      // If no path is provided, use today's daily note
      const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);
      
      // Get current time or use provided completion time
      const completionTime = params.completion_time || getCurrentTime();
      
      // Handle file creation if it doesn't exist
      const exists = await fileExists(filePath, plugin.app);
      if (!exists) {
        try {
          await createFile(filePath, '', plugin.app);
        } catch (error) {
          throw new ToolExecutionError(`Could not create file at ${filePath}: ${error.message}`);
        }
      }
      
      // Read the note
      const note = await readNote({plugin, filePath});

      // Create a task with the provided description and completion time
      const todoText = `${description} (${completionTime})`;
      const task: Task = {
        type: 'task',
        status: 'completed',
        todoText: todoText,
        comment: "",
        lineIndex: -1 // Will be set when inserted
      };


      // Add the content as a comment
      appendComment(task, params.comment);

      // Find the current spot for insertion
      const currentSpot = findCurrentSpot(note);

      // Insert the completed task at the current position
      const updatedNote = insertTaskAtPosition(note, task, currentSpot);

      // Update the file with the new content
      await updateNote({plugin, filePath, updatedNote});

      // Create navigation targets for the created completed todo
      const navigationTargets = createNavigationTargetsForTasks(
        updatedNote,
        [task],
        filePath,
        `Navigate to completed todo`
      );

      // Add navigation targets
      navigationTargets.forEach(target => context.addNavigationTarget(target));

      // Return success message with details
      const timeInfo = completionTime ? ` at ${completionTime}` : '';
      const resultMessage = t('tools.success.complete')
        .replace('{{task}}', description)
        .replace('{{time}}', timeInfo)
        .replace('{{path}}', filePath);

      context.progress(resultMessage);

    } catch (error) {
      console.error('Error creating completed todo:', error);
      if (error instanceof ToolExecutionError) {
        throw error;
      } else {
        throw new ToolExecutionError(t('errors.todos.createError')
          .replace('{{error}}', error.message || 'Unknown error'));
      }
    }
  }
};
