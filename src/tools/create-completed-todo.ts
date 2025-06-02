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
  icon: "check-circle",
  initialLabel: t('tools.createCompleted.label'),
  execute: async (context: ToolExecutionContext<CreateCompletedTodoToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { todo_text, comment, file_path, completion_time } = params;

    if (!todo_text) {
      context.setLabel(t('tools.actions.createCompleted.failed', { task: '' }));
      throw new ToolExecutionError("No to-do text provided");
    }

    context.setLabel(t('tools.actions.createCompleted.inProgress', { task: todo_text }));

    const filePath = file_path ? file_path : await getDailyNotePath(plugin.app);

    try {
      // Check if file exists, create if it doesn't
      const exists = await fileExists(filePath, plugin.app);
      if (!exists) {
        await createFile(filePath, "", plugin.app);
      }

      // Read the note
      const note = await readNote({ plugin, filePath });

      // Get current spot for insertion
      const currentSpot = findCurrentSpot(note);

      // Create completed task object and insert it at the current spot
      let updatedNote = JSON.parse(JSON.stringify(note));
      
      // Format the completion time if provided
      const currentTime = getCurrentTime(completion_time);
      
      const task: Task = {
        type: "task",
        status: "completed",
        todoText: todo_text + (currentTime ? t('tasks.format.completedAt', { time: currentTime }) : ''),
        comment: comment || "",
        lineIndex: -1, // Will be updated when the note is saved
      };

      // Insert at the current spot
      updatedNote = insertTaskAtPosition(
        updatedNote,
        task,
        currentSpot,
      );

      // Update the note
      await updateNote({ plugin, filePath, updatedNote });

      // Create navigation targets for the added task
      const navigationTargets = createNavigationTargetsForTasks(
        updatedNote,
        [task],
        filePath,
        t('tools.navigation.navigateToCompletedTodo')
      );

      // Add navigation targets
      navigationTargets.forEach(target => context.addNavigationTarget(target));

      context.setLabel(t('tools.actions.createCompleted.success', { task: todo_text }));
      context.progress(t('tools.success.complete', {
        task: todo_text,
        time: currentTime ? ` ${currentTime}` : '',
        path: filePath
      }));
    } catch (error) {
      context.setLabel(t('tools.actions.createCompleted.failed', { task: todo_text }));
      throw error;
    }
  }
};
