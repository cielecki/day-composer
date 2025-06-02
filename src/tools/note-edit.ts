import { readFile } from "../utils/fs/read-file";
import { getFile } from "../utils/fs/get-file";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";
import { fileExists } from "../utils/fs/file-exists";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";

const schema = {
  name: "note_edit",
  description: "Performs multiple edit operations on an existing document in the vault. Can replace text, insert at various positions, append, or prepend content. All edits are applied in sequence.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path of the document to edit (including .md extension)",
      },
      edits: {
        type: "array",
        description: "Array of edit operations to perform in sequence",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["replace", "insert_after", "insert_before", "insert_after_line", "insert_before_line", "append", "prepend"],
              description: "Type of edit operation"
            },
            content: {
              type: "string",
              description: "The content to insert, append, prepend, or use as replacement"
            },
            search_text: {
              type: "string",
              description: "Text to search for (required for replace, insert_after, insert_before operations)"
            },
            replacement_text: {
              type: "string",
              description: "Text to replace with (required for replace operations)"
            },
            line_number: {
              type: "integer",
              description: "Line number for insert_after_line or insert_before_line operations (1-based)"
            }
          },
          required: ["type", "content"]
        }
      },
    },
    required: ["path", "edits"]
  }
};

type EditOperation = {
  type: "replace" | "insert_after" | "insert_before" | "insert_after_line" | "insert_before_line" | "append" | "prepend";
  content: string;
  search_text?: string;
  replacement_text?: string;
  line_number?: number;
};

type NoteEditToolInput = {
  path: string;
  edits: EditOperation[];
};

export const noteEditTool: ObsidianTool<NoteEditToolInput> = {
  specification: schema,
  icon: "edit",
  initialLabel: t('tools.noteEdit.label'),
  execute: async (context: ToolExecutionContext<NoteEditToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { path, edits } = params;

    context.setLabel(t('tools.noteEdit.inProgress', { path }));

    try {
      // Check if the file exists
      const exists = await fileExists(path, plugin.app);

      if (!exists) {
        context.setLabel(t('tools.noteEdit.failed', { path }));
        throw new ToolExecutionError(`File not found: ${path}`);
      }

      // Read the existing file content
      const file = getFile(path, plugin.app);
      if (!file) {
        context.setLabel(t('tools.noteEdit.failed', { path }));
        throw new ToolExecutionError(`File not found: ${path}`);
      }
      
      let currentContent = await readFile(file, plugin.app);
      const editResults: string[] = [];

      // Apply edits in sequence
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const editNumber = i + 1;

        try {
          switch (edit.type) {
            case "replace":
              if (!edit.search_text || !edit.replacement_text) {
                throw new ToolExecutionError(`Edit ${editNumber}: Replace operation requires both search_text and replacement_text`);
              }
              if (!currentContent.includes(edit.search_text)) {
                throw new ToolExecutionError(`Edit ${editNumber}: Search text "${edit.search_text}" not found in document`);
              }
              currentContent = currentContent.replace(edit.search_text, edit.replacement_text);
              editResults.push(`✓ Edit ${editNumber}: Replaced "${edit.search_text}" with "${edit.replacement_text}"`);
              break;

            case "insert_after":
              if (!edit.search_text) {
                throw new ToolExecutionError(`Edit ${editNumber}: Insert after operation requires search_text`);
              }
              if (!currentContent.includes(edit.search_text)) {
                throw new ToolExecutionError(`Edit ${editNumber}: Search text "${edit.search_text}" not found in document`);
              }
              currentContent = currentContent.replace(edit.search_text, edit.search_text + edit.content);
              editResults.push(`✓ Edit ${editNumber}: Inserted content after "${edit.search_text}"`);
              break;

            case "insert_before":
              if (!edit.search_text) {
                throw new ToolExecutionError(`Edit ${editNumber}: Insert before operation requires search_text`);
              }
              if (!currentContent.includes(edit.search_text)) {
                throw new ToolExecutionError(`Edit ${editNumber}: Search text "${edit.search_text}" not found in document`);
              }
              currentContent = currentContent.replace(edit.search_text, edit.content + edit.search_text);
              editResults.push(`✓ Edit ${editNumber}: Inserted content before "${edit.search_text}"`);
              break;

            case "insert_after_line":
              if (!edit.line_number) {
                throw new ToolExecutionError(`Edit ${editNumber}: Insert after line operation requires line_number`);
              }
              const linesAfter = currentContent.split('\n');
              if (edit.line_number < 1 || edit.line_number > linesAfter.length) {
                throw new ToolExecutionError(`Edit ${editNumber}: Line number ${edit.line_number} is out of bounds (document has ${linesAfter.length} lines)`);
              }
              linesAfter.splice(edit.line_number, 0, edit.content);
              currentContent = linesAfter.join('\n');
              editResults.push(`✓ Edit ${editNumber}: Inserted content after line ${edit.line_number}`);
              break;

            case "insert_before_line":
              if (!edit.line_number) {
                throw new ToolExecutionError(`Edit ${editNumber}: Insert before line operation requires line_number`);
              }
              const linesBefore = currentContent.split('\n');
              if (edit.line_number < 1 || edit.line_number > linesBefore.length) {
                throw new ToolExecutionError(`Edit ${editNumber}: Line number ${edit.line_number} is out of bounds (document has ${linesBefore.length} lines)`);
              }
              linesBefore.splice(edit.line_number - 1, 0, edit.content);
              currentContent = linesBefore.join('\n');
              editResults.push(`✓ Edit ${editNumber}: Inserted content before line ${edit.line_number}`);
              break;

            case "append":
              currentContent = currentContent + '\n' + edit.content;
              editResults.push(`✓ Edit ${editNumber}: Appended content to end of document`);
              break;

            case "prepend":
              currentContent = edit.content + '\n' + currentContent;
              editResults.push(`✓ Edit ${editNumber}: Prepended content to start of document`);
              break;

            default:
              throw new ToolExecutionError(`Edit ${editNumber}: Unknown edit type "${edit.type}"`);
          }
        } catch (error) {
          context.setLabel(t('tools.noteEdit.failed', { path }));
          throw error;
        }
      }

      // Write the updated content back to the file
      await plugin.app.vault.modify(file, currentContent);

      // Add navigation target
      context.addNavigationTarget({
        filePath: path,
        description: t("tools.navigation.openEditedDocument")
      });

      context.setLabel(t('tools.noteEdit.completed', { path }));
      context.progress(`Successfully applied ${edits.length} edit(s) to ${path}:\n\n${editResults.join('\n')}`);
    } catch (error) {
      context.setLabel(t('tools.noteEdit.failed', { path }));
      throw error;
    }
  }
}; 