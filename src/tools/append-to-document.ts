import MyPlugin from "../main";
import { modifyFile } from "./utils/modifyFile";
import { readFile } from "./utils/readFile";
import { getFile } from "./utils/getFile";
import { ObsidianTool } from "../obsidian-tools";

const schema = {
  name: "append_to_document",
  description: "Appends content to an existing document",
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
      }
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
  getActionText: (input: AppendToDocumentToolInput, output: string, hasResult: boolean) => {
    let actionText = '';
    if (!input || typeof input !== 'object') actionText = '';
    if (input.path) actionText = `"${input.path}"`;
    if (hasResult) {
      return `Appended to ${actionText}`;
    } else {
      return `Appending to ${actionText}...`;
    }
  },
  execute: async (plugin: MyPlugin, params: AppendToDocumentToolInput): Promise<string> => {
    try {
      const { path, content } = params;
      const appendContent = content || ''; // Default to empty string if content is undefined

      // Get the file
      const file = getFile(path, plugin.app);
      
      if (!file) {
        return `Error: File not found at ${path}`;
      }
      
      // Read the current content
      const currentContent = await readFile(file, plugin.app);
      
      // Append the new content
      const newContent = currentContent + appendContent;
      
      // Update the file
      await modifyFile(file, newContent, plugin.app);
      
      return `Successfully appended content to ${path}`;
    } catch (error) {
      console.error('Error appending to document:', error);
      return `Error appending to document: ${error.message || 'Unknown error'}`;
    }
  }
};
