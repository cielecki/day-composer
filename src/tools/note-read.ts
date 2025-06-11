import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from '../types/tool-execution-context';
import { t } from 'src/i18n';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { TFile } from "obsidian";
import { expandLinks } from 'src/utils/links/expand-links';

const schema = {
  name: "note_read",
  description: "Reads the content of a note from the vault. Optionally expands Life Navigator links (like [[ln-day-note-(-1)]] 🧭) when expand_links is set to true.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path of the note to read (including .md extension)",
      },
      expand_links: {
        type: "boolean",
        description: "Whether to expand Life Navigator links (like [[ln-day-note-(-1)]] 🧭, [[ln-current-date-and-time]] 🧭, etc.) in the note content. Default: false",
        default: false
      }
    },
    required: ["path"]
  }
};

type NoteReadToolInput = {
  path: string;
  expand_links?: boolean;
}

export const noteReadTool: ObsidianTool<NoteReadToolInput> = {
  specification: schema,
  icon: "file-text",
  sideEffects: false, // Read-only operation, safe for link expansion
  get initialLabel() {
    return t('tools.read.labels.initial');
  },
  execute: async (context: ToolExecutionContext<NoteReadToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { path, expand_links = false } = params;

    context.setLabel(t('tools.read.labels.inProgress', { path }));

    try {
      // Read the file content
      const file = plugin.app.vault.getAbstractFileByPath(path);
      
      if (!file) {
        context.setLabel(t('tools.read.labels.failed', { path }));
        throw new ToolExecutionError(`File not found: ${path}`);
      }
      
      if (!(file instanceof TFile)) {
        context.setLabel(t('tools.read.labels.failed', { path }));
        throw new ToolExecutionError(`Path is not a file: ${path}`);
      }

      let content = await plugin.app.vault.read(file);
      
      // Expand Life Navigator links if requested
      if (expand_links) {
        try {
          content = (await expandLinks(plugin.app, content)).fullContent;
          context.progress(`Expanded Life Navigator links in: ${path}`);
        } catch (error) {
          // If link expansion fails, continue with original content but log warning
          console.warn(`Failed to expand links in ${path}:`, error);
          context.progress(`Warning: Failed to expand some links in: ${path}`);
        }
      }
      
      // Add navigation target
      context.addNavigationTarget({
        filePath: path,
        description: t("tools.navigation.openNote")
      });

      context.setLabel(t('tools.read.labels.completed', { path }));
      context.progress(content);
    } catch (error) {
      context.setLabel(t('tools.read.labels.failed', { path }));
      throw error;
    }
  }
};
