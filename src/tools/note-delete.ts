import { normalizePath } from "obsidian";
import { fileExists } from "../utils/fs/file-exists";
import { getFile } from "../utils/fs/get-file";
import { ensureDirectoryExists } from "../utils/fs/ensure-directory-exists";
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import i18next from 'i18next';

const schema = {
  name: "note_delete",
  description: "Safely deletes a note by moving it to the Trash/Śmietnik directory instead of permanent deletion. Creates the trash directory if it doesn't exist.",
  input_schema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "The path of the file to delete (including file extension)",
      },
      confirm_deletion: {
        type: "boolean",
        description: "Confirmation that the user wants to delete this file (defaults to false for safety)",
        default: false
      }
    },
    required: ["file_path"]
  }
};

type NoteDeleteToolInput = {
  file_path: string;
  confirm_deletion?: boolean;
}

/**
 * Get the appropriate trash directory name based on current language
 */
function getTrashDirectoryName(): string {
  const currentLanguage = i18next.language || 'en';
  return currentLanguage === 'pl' ? 'Śmietnik' : 'Trash';
}

/**
 * Generate a unique filename in trash if file already exists there
 */
async function getUniqueTrashPath(originalPath: string, trashDir: string, app: any): Promise<string> {
  const fileName = originalPath.split('/').pop() || 'unknown';
  const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
  const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
  
  let counter = 1;
  let trashPath = `${trashDir}/${fileName}`;
  
  while (await fileExists(trashPath, app)) {
    trashPath = `${trashDir}/${baseName} (${counter})${extension}`;
    counter++;
  }
  
  return trashPath;
}

export const noteDeleteTool: ObsidianTool<NoteDeleteToolInput> = {
  specification: schema,
  icon: "trash-2",
  sideEffects: true, // Modifies files by moving them to trash
  get initialLabel() {
    return t('tools.noteDelete.labels.initial');
  },
  execute: async (context: ToolExecutionContext<NoteDeleteToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { file_path, confirm_deletion = false } = params;
    
    context.setLabel(t('tools.noteDelete.labels.inProgress', { path: file_path }));

    try {
      // Safety check - require confirmation
      if (!confirm_deletion) {
        context.setLabel(t('tools.noteDelete.labels.requiresConfirmation'));
        throw new ToolExecutionError(t('tools.noteDelete.errors.confirmationRequired'));
      }

      // Normalize the source path
      const normalizedSourcePath = normalizePath(file_path);
      
      // Check if source file exists
      const sourceExists = await fileExists(normalizedSourcePath, plugin.app);
      if (!sourceExists) {
        context.setLabel(t('tools.noteDelete.labels.failed', { path: file_path }));
        throw new ToolExecutionError(t('tools.noteDelete.errors.fileNotFound', { path: file_path }));
      }
      
      // Get the source file
      const sourceFile = getFile(normalizedSourcePath, plugin.app);
      if (!sourceFile) {
        context.setLabel(t('tools.noteDelete.labels.failed', { path: file_path }));
        throw new ToolExecutionError(t('tools.noteDelete.errors.cannotAccess', { path: file_path }));
      }
      
      // Get trash directory name based on language
      const trashDirName = getTrashDirectoryName();
      
      // Create trash directory if it doesn't exist
              context.progress(t('tools.noteDelete.progress.creatingTrashDirectory', { dir: trashDirName }));
      await ensureDirectoryExists(trashDirName, plugin.app);
      
      // Generate unique path in trash directory
      const trashPath = await getUniqueTrashPath(normalizedSourcePath, trashDirName, plugin.app);
      const normalizedTrashPath = normalizePath(trashPath);
      
      // Perform the move operation to trash
              context.progress(t('tools.noteDelete.progress.movingToTrash', { source: file_path, destination: trashPath }));
      await plugin.app.vault.rename(sourceFile, normalizedTrashPath);
      
      // Add navigation target to the file in trash
      context.addNavigationTarget({
        filePath: normalizedTrashPath,
        description: t("tools.noteDelete.navigation.openDeletedFile")
      });
      
      context.setLabel(t('tools.noteDelete.labels.success', { path: file_path, trashDir: trashDirName }));
      context.progress(t('tools.noteDelete.progress.completed', { 
        source: file_path, 
        destination: trashPath,
        trashDir: trashDirName
      }));
      
    } catch (error) {
      context.setLabel(t('tools.noteDelete.labels.failed', { path: file_path }));
      throw error;
    }
  }
}; 