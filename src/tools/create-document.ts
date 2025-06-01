import MyPlugin from "../main";
import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { ToolExecutionContext } from "../utils/chat/types";
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
  getActionText: (input: CreateDocumentToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
    let actionText = '';
    if (!input || typeof input !== 'object') return '';
    if (input.path) actionText = `"${input.path}"`;
    
    if (hasError) {
      return t('tools.actions.createDocument.failed', { path: actionText });
    } else if (hasCompleted) {
      return t('tools.actions.createDocument.completed', { path: actionText });
    } else if (hasStarted) {
      return t('tools.actions.createDocument.inProgress', { path: actionText });
    } else {
      return t('tools.actions.createDocument.default', { path: actionText });
    }
  },
  execute: async (context: ToolExecutionContext<CreateDocumentToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { path, content } = params;
    const documentContent = content || ''; // Default to empty string if content is undefined

    // Check if the file already exists
    const exists = await fileExists(path, plugin.app);

    if (exists) {
      throw new ToolExecutionError(`File already exists at ${path}. Set overwrite to true to replace it.`);
    }

    // Create the file
    await createFile(path, documentContent, plugin.app);

    // Add navigation target
    context.addNavigationTarget({
      filePath: path,
      description: t("tools.navigation.openCreatedDocument")
    });

    context.progress(t('tools.createDocument.progress.success', { path }));
  }
};
