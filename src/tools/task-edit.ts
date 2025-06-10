import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { readNote, updateNote, NoteNode } from 'src/utils/tools/note-utils';
import { getDailyNotePath } from 'src/utils/daily-notes/get-daily-note-path';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { validateTasks } from 'src/utils/tasks/task-validation';
import { removeTaskFromDocument, insertTaskAtPosition, appendComment } from 'src/utils/tasks/task-utils';
import { createNavigationTargetsForTasks } from 'src/utils/tools/line-number-utils';
import { findTaskByDescription } from "src/utils/tools/note-utils";

const schema = {
  name: "task_edit",
  description: "Edits an existing to-do item by replacing it with updated information (text, status, comment)",
  input_schema: {
    type: "object",
    properties: {
      original_todo_text: {
        type: "string",
        description: "The complete text of the original to-do item to edit. This should include all formatting, emojis, time markers, and any other specific formatting.",
      },
      replacement_todo_text: {
        type: "string",
        description: "The new complete text for the to-do item. This should contain all formatting, emojis, time markers, and any other specific formatting you want to include.",
      },
      replacement_status: {
        type: "string",
        description: "The new status for the to-do item",
        enum: ["pending", "completed", "abandoned", "moved"]
      },
      replacement_comment: {
        type: "string",
        description: "Additional comment to add or replace for this task. Will be added as an indented comment below the task.",
      },
      file_path: {
        type: "string",
        description: "The path of the document containing the to-do (including .md extension). If not provided, searches only in today's daily note.",
      }
    },
    required: ["original_todo_text", "replacement_todo_text"]
  }
};

type TaskEditToolInput = {
  original_todo_text: string;
  replacement_todo_text: string;
  replacement_status?: "pending" | "completed" | "abandoned" | "moved";
  replacement_comment?: string;
  file_path?: string;
};

export const taskEditTool: ObsidianTool<TaskEditToolInput> = {
  specification: schema,
  icon: "edit",
  sideEffects: true, // Modifies files by editing tasks
  get initialLabel() {
    return t('tools.edit.label');
  },
  execute: async (context: ToolExecutionContext<TaskEditToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { original_todo_text } = params;
    
    context.setLabel(t('tools.actions.editTodo.inProgress', { task: original_todo_text }));
    
    try {
      const filePath = params.file_path ? params.file_path : await getDailyNotePath(plugin.app);
      const note = await readNote({plugin, filePath});
      
      // Validate that the original task exists
      validateTasks(
        note, 
        [{ todoText: original_todo_text }]
      );
      
      // Create a copy for modification
      let updatedNote = JSON.parse(JSON.stringify(note));
      
      // Find the task in the updated note
      const taskToUpdate = findTaskByDescription(updatedNote, original_todo_text, (task) => true);
      
      // Remember the original position for reinsertion
      const originalPosition = updatedNote.content.findIndex((node: NoteNode) => 
        node.type === 'task' && 
        node.todoText === taskToUpdate.todoText && 
        node.status === taskToUpdate.status
      );
      
      // Remove the original task
      updatedNote = removeTaskFromDocument(updatedNote, taskToUpdate);
      
      // Update task properties
      taskToUpdate.todoText = params.replacement_todo_text;
      
      if (params.replacement_status) {
        taskToUpdate.status = params.replacement_status;
      }
      
      // Handle comment replacement/addition
      if (params.replacement_comment !== undefined) {
        if (params.replacement_comment === "") {
          // Empty string means clear the comment
          taskToUpdate.comment = "";
        } else {
          // Replace or add new comment
          taskToUpdate.comment = "";
          appendComment(taskToUpdate, params.replacement_comment);
        }
      }
      
      // Insert the updated task at the same position
      updatedNote = insertTaskAtPosition(updatedNote, taskToUpdate, originalPosition);
      
      // Update the note
      await updateNote({plugin, filePath, updatedNote});
      
      // Create navigation targets for the edited task
      const navigationTargets = createNavigationTargetsForTasks(
        updatedNote,
        [taskToUpdate],
        filePath,
        t('tools.navigation.navigateToEditedTodo')
      );
      
      // Prepare success message
      const statusText = params.replacement_status ? ` (status: ${params.replacement_status})` : '';
      const commentText = params.replacement_comment ? ` with comment` : '';
      
      const resultMessage = t('tools.success.edit', {
        originalTask: original_todo_text,
        newTask: params.replacement_todo_text,
        path: filePath,
        details: `${statusText}${commentText}`
      });

      // Add navigation targets
      navigationTargets.forEach(target => context.addNavigationTarget(target));

      context.setLabel(t('tools.actions.editTodo.completed', { task: params.replacement_todo_text }));
      context.progress(resultMessage);
    } catch (error) {
      context.setLabel(t('tools.actions.editTodo.failed', { task: original_todo_text }));
      throw error;
    }
  }
}; 