import MyPlugin from "../main";
import { getDailyNotePath } from "../utils/daily-notes/get-daily-note-path";
import { ObsidianTool, ToolExecutionResult } from "../obsidian-tools";
import { findTaskByDescription } from "../utils/tools/note-utils";
import { updateNote } from '../utils/tools/note-utils';
import { readNote } from '../utils/tools/note-utils';
import { Task } from "../utils/task/task-utils";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { createNavigationTargetsForTasks } from "../utils/tools/line-number-utils";
import { t } from "../i18n";

const schema = {
  name: "uncheck_todo",
  description: "Unchecks a completed to-do item in a specified document or today's daily note",
  input_schema: {
    type: "object",
    properties: {
      todo_text: {
        type: "string",
        description: "The complete text of the to-do item to uncheck. This should include all formatting, emojis, time markers, and any other specific formatting.",
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

type UncheckTodoToolInput = {
  todo_text: string,
  file_path?: string,
  comment?: string
}

export const uncheckTodoTool: ObsidianTool<UncheckTodoToolInput> = {
  specification: schema,
  icon: "square",
  getActionText: (input: UncheckTodoToolInput, output: string, hasResult: boolean, hasError: boolean) => {
    let actionText = '';
    if (!input || typeof input !== 'object') actionText = '';
    if (input.todo_text) actionText = `"${input.todo_text}"`;
    if (hasResult) {
      return hasError
        ? t('tools.actions.uncheck.failed').replace('{{task}}', actionText)
        : t('tools.actions.uncheck.success').replace('{{task}}', actionText);
    } else {
      return t('tools.actions.uncheck.inProgress').replace('{{task}}', actionText);
    }
  },
  execute: async (plugin: MyPlugin, params: UncheckTodoToolInput): Promise<ToolExecutionResult> => {
    const todoDescription = params.todo_text;
    const comment = params.comment;
    const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);

    const note = await readNote({plugin, filePath})

    // Find the task
    const task = findTaskByDescription(note, todoDescription, (task) => task.status !== 'pending');
    
    // Check if task was found
    if (!task) {
      throw new ToolExecutionError(t('errors.tasks.notFound', {
        task: todoDescription,
        path: filePath
      }));
    }

    // Update status directly on the task (it's already part of the note structure)
    task.status = 'pending';

    // Add comment if provided
    if (comment) {
      task.comment = task.comment ? task.comment + "\n    " + comment : "    " + comment;
    }

    // Update the note with the modified task
    await updateNote({plugin, filePath, updatedNote: note})

    // Create navigation targets for the unchecked task
    const navigationTargets = createNavigationTargetsForTasks(
      note,
      [task],
      filePath,
      t('tools.navigation.navigateToUncheckedTodo')
    );

    const resultMessage = t('tools.success.uncheck', {
      task: todoDescription,
      path: filePath
    });

    return {
      result: resultMessage,
      navigationTargets: navigationTargets
    };
  }
};
