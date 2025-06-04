import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from '../types/chat-types';
import { t } from 'src/i18n';
import { ToolExecutionError } from '../types/tool-execution-error';
import { TFile } from "obsidian";

const schema = {
  name: "note_read",
  description: "Reads the content of a note from the vault",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path of the note to read (including .md extension)",
      }
    },
    required: ["path"]
  }
};

type NoteReadToolInput = {
  path: string
}

export const noteReadTool: ObsidianTool<NoteReadToolInput> = {
  specification: schema,
  icon: "file-text",
  initialLabel: t('tools.read.label'),
  execute: async (context: ToolExecutionContext<NoteReadToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { path } = params;

    context.setLabel(t('tools.read.inProgress', { path }));

    try {
      // Read the file content
      const file = plugin.app.vault.getAbstractFileByPath(path);
      
      if (!file) {
        context.setLabel(t('tools.read.failed', { path }));
        throw new ToolExecutionError(`File not found: ${path}`);
      }
      
      if (!(file instanceof TFile)) {
        context.setLabel(t('tools.read.failed', { path }));
        throw new ToolExecutionError(`Path is not a file: ${path}`);
      }

      const content = await plugin.app.vault.read(file);
      
      // Add navigation target
      context.addNavigationTarget({
        filePath: path,
        description: t("tools.navigation.openNote")
      });

      context.setLabel(t('tools.read.completed', { path }));
      context.progress(content);
    } catch (error) {
      context.setLabel(t('tools.read.failed', { path }));
      throw error;
    }
  }
};
