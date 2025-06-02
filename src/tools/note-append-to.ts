import { readFile } from "../utils/fs/read-file";
import { getFile } from "../utils/fs/get-file";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";
import { fileExists } from "../utils/fs/file-exists";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";

const schema = {
  name: "note_append_to",
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

type NoteAppendToToolInput = {
  path: string,
  content: string
}

export const noteAppendToTool: ObsidianTool<NoteAppendToToolInput> = {
  specification: schema,
  icon: "file-plus",
  initialLabel: t('tools.append.label'),
  execute: async (context: ToolExecutionContext<NoteAppendToToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { path, content } = params;

    context.setLabel(t('tools.append.inProgress', { path }));

    try {
      // Check if the file exists
      const exists = await fileExists(path, plugin.app);

      if (!exists) {
        context.setLabel(t('tools.append.failed', { path }));
        throw new ToolExecutionError(`File not found: ${path}`);
      }

      // Read the existing file content
      const file = getFile(path, plugin.app);
      if (!file) {
        context.setLabel(t('tools.append.failed', { path }));
        throw new ToolExecutionError(`File not found: ${path}`);
      }
      
      const existingContent = await readFile(file, plugin.app);

      // Append the new content
      const newContent = `${existingContent}\n${content}`;

      // Write the updated content back to the file
      await plugin.app.vault.modify(file, newContent);

      // Add navigation target
      context.addNavigationTarget({
        filePath: path,
        description: t("tools.navigation.openAppendedDocument")
      });

      context.setLabel(t('tools.append.completed', { path }));
      context.progress(t('tools.progress.appendToDocument.success', { path }));
    } catch (error) {
      context.setLabel(t('tools.append.failed', { path }));
      throw error;
    }
  }
};
