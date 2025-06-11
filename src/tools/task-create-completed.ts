import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { getCurrentTime } from "../utils/time/get-current-time";
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { findCurrentSpot, readNote, updateNote } from 'src/utils/tools/note-utils';
import { getDailyNotePath } from 'src/utils/daily-notes/get-daily-note-path';
import { createNavigationTargetsForTasks } from 'src/utils/tools/line-number-utils';
import { appendComment, insertTaskAtPosition, Task } from "src/utils/tasks/task-utils";

const schema = {
  name: "task_create_completed",
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

type TaskCreateCompletedToolInput = {
  todo_text: string,
  comment?: string,
  file_path?: string,
  completion_time?: string
}

export const taskCreateCompletedTool: ObsidianTool<TaskCreateCompletedToolInput> = {
  specification: schema,
  icon: "check-circle",
  sideEffects: true, // Modifies files by creating completed tasks
  get initialLabel() {
    return t('tools.createCompleted.labels.initial');
  },
  execute: async (context: ToolExecutionContext<TaskCreateCompletedToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { todo_text, comment, file_path, completion_time } = params;

    if (!todo_text) {
      context.setLabel(t('tools.createCompleted.labels.failed', { task: '' }));
      throw new ToolExecutionError("No to-do text provided");
    }

    context.setLabel(t('tools.createCompleted.labels.inProgress', { task: todo_text }));

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
      
      let task: Task = {
        type: "task",
        status: "completed",
        todoText: todo_text + (currentTime ? t('tasks.format.completedAt', { time: currentTime }) : ''),
        comment: "",
        lineIndex: -1, // Will be updated when the note is saved
      };

      if (comment) {
        appendComment(task, comment);
      }

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
        filePath
      );

      // Add navigation targets
      navigationTargets.forEach(target => context.addNavigationTarget(target));

      context.setLabel(t('tools.createCompleted.labels.success', { task: todo_text }));
      context.progress(t('tools.createCompleted.progress.success', {
        task: todo_text,
        time: currentTime ? ` ${currentTime}` : '',
        name: filePath
      }));
    } catch (error) {
      context.setLabel(t('tools.createCompleted.labels.failed', { task: todo_text }));
      throw error;
    }
  }
};