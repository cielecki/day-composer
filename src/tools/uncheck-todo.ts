import MyPlugin from "../main";
import { getDailyNotePath } from "./utils/getDailyNotePath";
import { ObsidianTool } from "../obsidian-tools";
import { findTaskByDescription } from "./utils/note-utils";
import { updateNote } from './utils/note-utils';
import { readNote } from './utils/note-utils';
import { Task } from "./utils/task-utils";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { t } from "../i18n";

const schema = {
  name: "uncheck_todo",
  description: "Unchecks a completed to-do item in a specified document or today's daily note",
  input_schema: {
    type: "object",
    properties: {
      todo_text: {
        type: "string",
        description: "The exact text of the to-do item to uncheck",
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
  execute: async (plugin: MyPlugin, params: UncheckTodoToolInput): Promise<string> => {
    const todoDescription = params.todo_text;
    const comment = params.comment;
    const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);

    const note = await readNote({plugin, filePath})

    // Find the task
    const task = findTaskByDescription(note, todoDescription);
    
    // Check if task was found
    if (!task) {
      throw new ToolExecutionError(t('errors.tasks.notFound', {
        task: todoDescription,
        path: filePath
      }));
    }

    // Create a copy to avoid modifying the original
    const updatedTask: Task = JSON.parse(JSON.stringify(task));

    // Update status
    updatedTask.status = 'pending';
    updatedTask.timeInfo.completed = null;

    // Add comment if provided
    if (comment) {
      updatedTask.comment = updatedTask.comment ? updatedTask.comment + "\n" + comment : comment;
    }

    await updateNote({plugin, filePath, updatedNote: note})

    return t('tools.success.uncheck', {
      task: todoDescription,
      path: filePath
    });
  }
};
