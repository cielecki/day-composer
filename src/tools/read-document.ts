import MyPlugin from "../main";
import { readFile } from "./utils/readFile";
import { getFile } from "./utils/getFile";
import { ObsidianTool } from "../obsidian-tools";
import { t } from "../i18n";
import { ToolExecutionError } from "./utils/ToolExecutionError";

const schema = {
  name: "read_document",
  description: "Reads the content of a document at the specified path",
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
  getActionText: (input: ReadDocumentToolInput, output: string, hasResult: boolean) => {
    let actionText = '';
    if (!input || typeof input !== 'object') actionText = '';
    if (input.path) actionText = `"${input.path}"`;
    
    if (hasResult) {
      return t('tools.readDocument', { defaultValue: 'Read' }) + ' ' + actionText;
    } else {
      return t('tools.readDocument', { defaultValue: 'Reading' }) + ' ' + actionText + '...';
    }
  },
  execute: async (plugin: MyPlugin, params: ReadDocumentToolInput): Promise<string> => {
    const { path } = params;
    
    // Get the file
    const file = getFile(path, plugin.app);
    
    if (!file) {
      throw new ToolExecutionError(t('errors.documents.notFound').replace('{{path}}', path));
    }
    
    // Read the file content
    const content = await readFile(file, plugin.app);
    return content; 
  }
};
