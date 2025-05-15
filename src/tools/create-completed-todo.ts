import MyPlugin from "../main";
import { createFile } from "./utils/createFile";
import { fileExists } from "./utils/fileExists";
import { getCurrentTime } from "./utils/getCurrentTime";
import { createTask, appendCommentLine, insertTaskAtPosition } from "./utils/task-utils";
import { suggestEmojiForTask } from "./utils/suggest-emoji-for-task";
import { ToolExecutionError } from "./utils/ToolExecutionError";
import { ObsidianTool } from "../obsidian-tools";
import { findCurrentSpot, readNote, updateNote } from "./utils/note-utils";
import { getDailyNotePath } from "./utils/getDailyNotePath";
import { t } from "../i18n";

const schema = {
  name: "create_completed_todo",
  description: "Creates a completed todo entry for storing notes in your daily log. Perfect for recording thoughts, observations, or events that don't require further action.",
  input_schema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "The description of the completed todo item (defaults to 'Note' if not provided)",
      },
      content: {
        type: "string",
        description: "The content to add as an indented comment below the completed todo",
      },
      path: {
        type: "string",
        description: "The path of the document to add the completed todo to (including .md extension). If not provided, adds to today's daily note.",
      },
      emoji: {
        type: "string",
        description: "Optional emoji to add to the completed todo. If not provided, an appropriate emoji will be suggested based on the content.",
      },
      completion_time: {
        type: "string",
        description: "Optional completion time in HH:MM format. If not provided, current time will be used.",
      }
    },
    required: ["content"]
  }
};

type CreateCompletedTodoToolInput = {
  description?: string,
  content: string,
  path?: string,
  emoji?: string,
  completion_time?: string
}

export const createCompletedTodoTool: ObsidianTool<CreateCompletedTodoToolInput> = {
  specification: schema,
  icon: "check-square-2",
  getActionText: (input: CreateCompletedTodoToolInput, output: string, hasResult: boolean, hasError: boolean) => {
    const contentPreview = input?.content ? 
      (input.content.length > 20 ? input.content.substring(0, 20) + '...' : input.content) :
      'entry';
    
    if (hasResult) {
      return hasError
        ? t('tools.actions.complete.failed')
        : t('tools.actions.complete.success').replace('{{content}}', contentPreview);
    } else {
      return t('tools.actions.complete.inProgress');
    }
  },
  execute: async (plugin: MyPlugin, params: CreateCompletedTodoToolInput): Promise<string> => {
    try {
      const { content } = params;
      
      // Use "Note" as default description if not provided
      const description = params.description || "Note";
      
      // If no path is provided, use today's daily note
      const filePath = params.path ? params.path : await getDailyNotePath(plugin.app);
      
      // Use provided emoji or suggest based on content and description
      const emoji = params.emoji || suggestEmojiForTask(description + " " + content);
      
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

      // Create a task with the provided description
      const task = createTask(description, emoji, null);
      // Update status and completion time
      task.status = 'completed';
      task.timeInfo.completed = completionTime;

      // Add the content as a comment
      appendCommentLine(task, content);

      // Find the current spot for insertion
      const currentSpot = findCurrentSpot(note);

      // Insert the completed task at the current position
      const updatedNote = insertTaskAtPosition(note, task, currentSpot);

      // Update the file with the new content
      await updateNote({plugin, filePath, updatedNote});

      // Return success message with details
      const timeInfo = completionTime ? ` at ${completionTime}` : '';
      return t('tools.success.complete')
        .replace('{{task}}', description)
        .replace('{{time}}', timeInfo)
        .replace('{{path}}', filePath);

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
