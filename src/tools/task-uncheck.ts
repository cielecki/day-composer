import { getDailyNotePath } from 'src/utils/daily-notes/get-daily-note-path';
import { ObsidianTool } from 'src/obsidian-tools';
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { updateNote } from 'src/utils/tools/note-utils';
import { readNote } from 'src/utils/tools/note-utils';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { createNavigationTargetsForTasks } from 'src/utils/tools/line-number-utils';
import { t } from 'src/i18n';
import { findTaskByDescription } from "src/utils/tools/note-utils";
import { appendComment, cleanTodoText } from 'src/utils/tasks/task-utils';
import { extractFilenameWithoutExtension } from "src/utils/text/string-sanitizer";

const schema = {
  name: "task_uncheck",
  description: "Unchecks a completed to-do item in a specified document or today's daily note",
  input_schema: {
    type: "object",
    properties: {
      todo_text: {
        type: "string",
        description: "The complete text of the to-do item to uncheck, without the task marker (e.g. '- [ ]'). This should include all formatting, emojis, time markers, and any other specific formatting.",
      },
      file_path: {
        type: "string",
        description: "The path of the document containing the to-do (including .md extension). If not provided, searches only in today's daily note.",
      },
      comment: {
        type: "string",
        description: "Optional comment to add below the unchecked item explaining why it was unchecked."
      }
    },
    required: ["todo_text"]
  }
};

type TaskUncheckToolInput = {
  todo_text: string,
  file_path?: string,
  comment?: string
}

export const taskUncheckTool: ObsidianTool<TaskUncheckToolInput> = {
  specification: schema,
  icon: "square",
  sideEffects: true, // Modifies files by unchecking tasks
  get initialLabel() {
    return t('tools.uncheck.labels.initial');
  },
  execute: async (context: ToolExecutionContext<TaskUncheckToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const todoDescription = cleanTodoText(params.todo_text);
    const comment = params.comment;
    const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);
    
    context.setLabel(t('tools.uncheck.labels.inProgress', { task: todoDescription }));
    
    try {
      const note = await readNote({plugin, filePath})

      // Find the task
      const task = findTaskByDescription(note, todoDescription, (task) => task.status !== 'pending');
      
      // Check if task was found
      if (!task) {
        context.setLabel(t('tools.uncheck.labels.failed', { 
          task: todoDescription,
          name: extractFilenameWithoutExtension(filePath)
        }));
        throw new ToolExecutionError(t('errors.tasks.notFound', {
          task: todoDescription,
          name: extractFilenameWithoutExtension(filePath)
        }));
      }

      // Update status directly on the task (it's already part of the note structure)
      task.status = 'pending';

      // Add comment if provided
      if (comment) {
        appendComment(task, comment);
      }

      // Update the note with the modified task
      await updateNote({plugin, filePath, updatedNote: note})

      // Create navigation targets for the unchecked task
      const navigationTargets = createNavigationTargetsForTasks(
        note,
        [task],
        filePath
      );

      // Add navigation targets
      navigationTargets.forEach(target => context.addNavigationTarget(target));

      context.setLabel(t('tools.uncheck.labels.success', { 
        task: todoDescription,
        name: extractFilenameWithoutExtension(filePath)
      }));
      context.progress(t('tools.uncheck.progress.success', {
        task: todoDescription,
        filePath
      }));
    } catch (error) {
      context.setLabel(t('tools.uncheck.labels.failed', { 
        task: todoDescription,
        name: extractFilenameWithoutExtension(filePath)
      }));
      throw error;
    }
  }
};
