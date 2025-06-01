import MyPlugin from "../main";
import { readFile } from "../utils/fs/read-file";
import { getFile } from "../utils/fs/get-file";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";

const schema = {
  name: "read_document",
  description: "Reads the content of a document from the vault",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path of the document to read (including .md extension)",
      }
    },
    required: ["path"]
  }
};

type ReadDocumentToolInput = {
  path: string
}

export const readDocumentTool: ObsidianTool<ReadDocumentToolInput> = {
  specification: schema,
  icon: "file-text",
  getActionText: (input: ReadDocumentToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
    let actionText = '';
    if (!input || typeof input !== 'object') return '';
    if (input.path) actionText = `"${input.path}"`;
    
    if (hasError) {
      return `Failed to read ${actionText}`;
    } else if (hasCompleted) {
      return t('tools.readDocument', { defaultValue: 'Read' }) + ' ' + actionText;
    } else if (hasStarted) {
      return t('tools.readDocument', { defaultValue: 'Reading' }) + ' ' + actionText + '...';
    } else {
      return `Read ${actionText}`;
    }
  },
  execute: async (context: ToolExecutionContext<ReadDocumentToolInput>): Promise<void> => {
    try {
      const { plugin, params } = context;
      const { path } = params;
      
      context.progress(`Locating document at ${path}...`);
      
      // Get the file
      const file = getFile(path, plugin.app);
      
      if (!file) {
        throw new ToolExecutionError(t('errors.documents.notFound', { path }));
      }
      
      context.progress(`Reading document content...`);
      
      // Read the content
      const content = await readFile(file, plugin.app);
      
      // Add navigation target
      context.addNavigationTarget({
        filePath: path,
        description: t("tools.navigation.openReadDocument")
      });
      
      context.progress(content);
    } catch (error) {
      console.error('Error reading document:', error);
      throw new Error(`Error reading document: ${error.message || 'Unknown error'}`);
    }
  }
};
