import MyPlugin from "../main";
import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { ObsidianTool, ToolExecutionResult } from "../obsidian-tools";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { t } from "../i18n";

const schema = {
  name: "create_document",
  description: "Creates a new document in the vault at the specified path with the provided content. Will throw an error if a document already exists at the specified path.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path where the document should be created (including filename with .md extension)",
      },
      content: {
        type: "string",
        description: "The content to write to the new document",
      },
    },
    required: ["path", "content"]
  }
};

type CreateDocumentToolInput = {
  path: string,
  content: string
}

export const createDocumentTool: ObsidianTool<CreateDocumentToolInput> = {
  specification: schema,
  icon: "file-plus",
  getActionText: (input: CreateDocumentToolInput, output: string, hasResult: boolean) => {
    let actionText = '';
    if (!input || typeof input !== 'object') actionText = '';
    if (input.path) actionText = `"${input.path}"`;
    if (hasResult) {
      return `Created ${actionText}`;
    } else {
      return `Creating ${actionText}...`;
    }
  },
  execute: async (plugin: MyPlugin, params: CreateDocumentToolInput): Promise<ToolExecutionResult> => {
    const { path, content } = params;
    const documentContent = content || ''; // Default to empty string if content is undefined

    // Check if the file already exists
    const exists = await fileExists(path, plugin.app);

    if (exists) {
      throw new ToolExecutionError(`File already exists at ${path}. Set overwrite to true to replace it.`);
    }

    // Create the file
    await createFile(path, documentContent, plugin.app);

    return {
      result: `Successfully created document at ${path}`,
      navigationTargets: [{
        filePath: path,
        description: t("tools.navigation.openCreatedDocument")
      }]
    };
  }
};
