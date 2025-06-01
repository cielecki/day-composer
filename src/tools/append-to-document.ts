import MyPlugin from "../main";
import { modifyFile } from "../utils/fs/modify-file";
import { readFile } from "../utils/fs/read-file";
import { getFile } from "../utils/fs/get-file";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";

const schema = {
  name: "append_to_document",
  description: "Appends content to an existing document in the vault",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path of the document to append to (including .md extension)",
      },
      content: {
        type: "string",
        description: "The content to append to the document",
      },
    },
    required: ["path", "content"]
  }
};

type AppendToDocumentToolInput = {
  path: string,
  content: string
}

export const appendToDocumentTool: ObsidianTool<AppendToDocumentToolInput> = {
  specification: schema,
  icon: "file-plus-2",
  getActionText: (input: AppendToDocumentToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
    let actionText = '';
    if (!input || typeof input !== 'object') return '';
    if (input.path) actionText = `"${input.path}"`;
    
    if (hasError) {
      return t('tools.actions.appendDocument.failed', { path: actionText });
    } else if (hasCompleted) {
      return `Appended to ${actionText}`;
    } else if (hasStarted) {
      return `Appending to ${actionText}...`;
    } else {
      return `Append to ${actionText}`;
    }
  },
  execute: async (context: ToolExecutionContext<AppendToDocumentToolInput>): Promise<void> => {
    try {
      const { plugin, params } = context;
      const { path, content } = params;
      const appendContent = content || ''; // Default to empty string if content is undefined

      // Get the file
      const file = getFile(path, plugin.app);
      
      if (!file) {
        throw new Error(`File not found at ${path}`);
      }
      
      // Read the current content
      const currentContent = await readFile(file, plugin.app);
      
      // Append the new content
      const newContent = currentContent + appendContent;
      
      // Update the file
      await modifyFile(file, newContent, plugin.app);
      
      // Add navigation target
      context.addNavigationTarget({
        filePath: path,
        description: t("tools.navigation.openAppendedDocument")
      });
      
      context.progress(t('tools.appendDocument.progress.success', { path }));
    } catch (error) {
      console.error('Error appending to document:', error);
      throw new Error(`Error appending to document: ${error.message || 'Unknown error'}`);
    }
  }
};
