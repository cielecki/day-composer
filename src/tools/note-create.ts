import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";

const schema = {
  name: "note_create",
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

type NoteCreateToolInput = {
  path: string,
  content: string
}

export const noteCreateTool: ObsidianTool<NoteCreateToolInput> = {
  specification: schema,
  icon: "file-plus",
  initialLabel: t('tools.actions.createDocument.default', { path: '' }),
  execute: async (context: ToolExecutionContext<NoteCreateToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { path, content } = params;
    const documentContent = content || ''; // Default to empty string if content is undefined

    context.setLabel(t('tools.actions.createDocument.inProgress', { path: `"${path}"` }));

    // Check if the file already exists
    const exists = await fileExists(path, plugin.app);

    if (exists) {
      context.setLabel(t('tools.actions.createDocument.failed', { path: `"${path}"` }));
      throw new ToolExecutionError(`File already exists at ${path}. Set overwrite to true to replace it.`);
    }

    // Create the file
    await createFile(path, documentContent, plugin.app);

    // Add navigation target
    context.addNavigationTarget({
      filePath: path,
      description: t("tools.navigation.openCreatedDocument")
    });

    context.setLabel(t('tools.actions.createDocument.completed', { path: `"${path}"` }));
    context.progress(t('tools.createDocument.progress.success', { path }));
  }
};
