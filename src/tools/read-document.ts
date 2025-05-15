import MyPlugin from "../main";
import { readFile } from "./utils/readFile";
import { getFile } from "./utils/getFile";
import { ObsidianTool } from "../obsidian-tools";
import { t } from "../i18n";

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
      return `Read ${actionText}`;
    } else {
      return `Reading ${actionText}...`;
    }
  },
  execute: async (plugin: MyPlugin, params: ReadDocumentToolInput): Promise<string> => {
    try {
      const { path } = params;
      
      // Get the file
      const file = getFile(path, plugin.app);
      
      if (!file) {
        return t('errors.documents.notFound').replace('{{path}}', path);
      }
      
      // Read the file content
      const content = await readFile(file, plugin.app);
      return content;
    } catch (error) {
      console.error('Error reading document:', error);
      return t('errors.documents.readError').replace('{{error}}', error.message || 'Unknown error');
    }
  }
};
