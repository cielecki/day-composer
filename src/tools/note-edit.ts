import { readFile } from "../utils/fs/read-file";
import { getFile } from "../utils/fs/get-file";
import { ObsidianTool, NavigationTarget } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { extractFilenameWithoutExtension } from "src/utils/text/string-sanitizer";
import { fileExists } from "../utils/fs/file-exists";
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { createPatch } from 'diff';

/**
 * Normalize text for better matching by handling different line endings and whitespace
 */
function normalizeTextForMatching(text: string): string {
  return text
    .replace(/\r\n/g, '\n')  // Convert Windows line endings
    .replace(/\r/g, '\n')    // Convert Mac line endings
    .replace(/\t/g, '    ')  // Convert tabs to spaces
}

/**
 * Find text in content with normalized matching
 */
function findTextInContent(content: string, searchText: string): number {
  const normalizedContent = normalizeTextForMatching(content);
  const normalizedSearch = normalizeTextForMatching(searchText);
  return normalizedContent.indexOf(normalizedSearch);
}

/**
 * Replace text in content with normalized matching
 */
function replaceTextInContent(content: string, searchText: string, replacementText: string): string {
  const index = findTextInContent(content, searchText);
  if (index === -1) {
    return content; // No match found
  }
  
  const normalizedSearch = normalizeTextForMatching(searchText);
  const normalizedContent = normalizeTextForMatching(content);
  
  // Find the actual position in the original content
  let actualIndex = 0;
  let normalizedIndex = 0;
  
  while (normalizedIndex < index && actualIndex < content.length) {
    const originalChar = content[actualIndex];
    const normalizedChar = normalizedContent[normalizedIndex];
    
    if (originalChar === '\r' && content[actualIndex + 1] === '\n') {
      // Windows line ending \r\n -> \n
      actualIndex += 2;
      normalizedIndex += 1;
    } else if (originalChar === '\r') {
      // Mac line ending \r -> \n
      actualIndex += 1;
      normalizedIndex += 1;
    } else if (originalChar === '\t') {
      // Tab -> 4 spaces
      actualIndex += 1;
      normalizedIndex += 4;
    } else {
      actualIndex += 1;
      normalizedIndex += 1;
    }
  }
  
  // Find the end position
  let endIndex = actualIndex;
  let remainingNormalized = normalizedSearch.length;
  
  while (remainingNormalized > 0 && endIndex < content.length) {
    const originalChar = content[endIndex];
    
    if (originalChar === '\r' && content[endIndex + 1] === '\n') {
      endIndex += 2;
      remainingNormalized -= 1;
    } else if (originalChar === '\r') {
      endIndex += 1;
      remainingNormalized -= 1;
    } else if (originalChar === '\t') {
      endIndex += 1;
      remainingNormalized -= 4;
    } else {
      endIndex += 1;
      remainingNormalized -= 1;
    }
  }
  
  return content.substring(0, actualIndex) + replacementText + content.substring(endIndex);
}

/**
 * Get line number for a character position in text
 */
function getLineNumberForPosition(content: string, position: number): number {
  return content.substring(0, position).split('\n').length;
}

/**
 * Parse the diff output to extract the first and last line numbers of actual changes (not context)
 */
function parseLineRangeFromDiff(diffOutput: string): { minLine: number; maxLine: number } {
  const lines = diffOutput.split('\n');
  let minLine = Infinity;
  let maxLine = -1;
  let currentNewLineNumber = 0;

  for (const line of lines) {
    // Look for @@ lines that indicate chunk headers
    const chunkMatch = line.match(/@@ -\d+,?\d* \+(\d+),?(\d*) @@/);
    if (chunkMatch) {
      currentNewLineNumber = parseInt(chunkMatch[1]);
      continue;
    }

    // Track line numbers and look for actual changes (+ or - lines)
    if (currentNewLineNumber > 0) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        // This is an added line
        minLine = Math.min(minLine, currentNewLineNumber);
        maxLine = Math.max(maxLine, currentNewLineNumber);
        currentNewLineNumber++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        // This is a deleted line - we still want to highlight where it was
        minLine = Math.min(minLine, currentNewLineNumber);
        maxLine = Math.max(maxLine, currentNewLineNumber);
        // Don't increment line number for deleted lines
      } else if (line.startsWith(' ') || (!line.startsWith('+') && !line.startsWith('-') && !line.startsWith('@'))) {
        // This is a context line or unchanged line
        currentNewLineNumber++;
      }
    }
  }

  // If no actual changes found, fall back to 1
  if (minLine === Infinity || maxLine === -1) {
    return { minLine: 1, maxLine: 1 };
  }

  return { minLine, maxLine };
}



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
            search_text: {
              type: "string",
              description: "Text to search for (required for replace, insert_after, insert_before operations)"
            },
            content: {
              type: "string",
              description: "The content to use for the operation - replacement text for replace operations, or content to insert/append/prepend for other operations"
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
  line_number?: number;
};

type NoteEditToolInput = {
  path: string;
  edits: EditOperation[];
};

export const noteEditTool: ObsidianTool<NoteEditToolInput> = {
  specification: schema,
  icon: "edit",
  sideEffects: true, // Modifies files, has side effects
  get initialLabel() {
    return t('tools.noteEdit.labels.initial');
  },
  execute: async (context: ToolExecutionContext<NoteEditToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { path, edits } = params;

    context.setLabel(t('tools.noteEdit.labels.inProgress', { name: extractFilenameWithoutExtension(path) }));

    try {
      // Check if the file exists
      const exists = await fileExists(path, plugin.app);

      if (!exists) {
        context.setLabel(t('tools.noteEdit.labels.failed', { name: extractFilenameWithoutExtension(path) }));
        throw new ToolExecutionError(`File not found: ${path}`);
      }

      // Read the existing file content
      const file = getFile(path, plugin.app);
      if (!file) {
        context.setLabel(t('tools.noteEdit.labels.failed', { name: extractFilenameWithoutExtension(path) }));
        throw new ToolExecutionError(`File not found: ${path}`);
      }
      
      let currentContent = await readFile(file, plugin.app);
      const originalContent = currentContent; // Store original for diff
      const editResults: string[] = [];

      // Apply edits in sequence
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const editNumber = i + 1;

        try {
          switch (edit.type) {
            case "replace":
              if (!edit.search_text) {
                throw new ToolExecutionError(`Edit ${editNumber}: Replace operation requires search_text`);
              }
              const replaceIndex = findTextInContent(currentContent, edit.search_text);
              if (replaceIndex === -1) {
                const normalizedSearch = normalizeTextForMatching(edit.search_text);
                const preview = normalizedSearch.length > 100 ? normalizedSearch.substring(0, 100) + '...' : normalizedSearch;
                throw new ToolExecutionError(`Edit ${editNumber}: Search text not found in document.\nLooking for: "${preview}"\nTry checking for differences in whitespace, line endings, or formatting.`);
              }
              const originalLineNumber = getLineNumberForPosition(currentContent, replaceIndex);
              currentContent = replaceTextInContent(currentContent, edit.search_text, edit.content);
              editResults.push(`✓ Edit ${editNumber}: Replaced text at line ${originalLineNumber}`);
              break;

            case "insert_after":
              if (!edit.search_text) {
                throw new ToolExecutionError(`Edit ${editNumber}: Insert after operation requires search_text`);
              }
              const insertAfterIndex = findTextInContent(currentContent, edit.search_text);
              if (insertAfterIndex === -1) {
                const normalizedSearch = normalizeTextForMatching(edit.search_text);
                const preview = normalizedSearch.length > 100 ? normalizedSearch.substring(0, 100) + '...' : normalizedSearch;
                throw new ToolExecutionError(`Edit ${editNumber}: Search text not found in document.\nLooking for: "${preview}"\nTry checking for differences in whitespace, line endings, or formatting.`);
              }
              const originalLineNumberAfter = getLineNumberForPosition(currentContent, insertAfterIndex);
              currentContent = replaceTextInContent(currentContent, edit.search_text, edit.search_text + edit.content);
              editResults.push(`✓ Edit ${editNumber}: Inserted content after text at line ${originalLineNumberAfter}`);
              break;

            case "insert_before":
              if (!edit.search_text) {
                throw new ToolExecutionError(`Edit ${editNumber}: Insert before operation requires search_text`);
              }
              const insertBeforeIndex = findTextInContent(currentContent, edit.search_text);
              if (insertBeforeIndex === -1) {
                const normalizedSearch = normalizeTextForMatching(edit.search_text);
                const preview = normalizedSearch.length > 100 ? normalizedSearch.substring(0, 100) + '...' : normalizedSearch;
                throw new ToolExecutionError(`Edit ${editNumber}: Search text not found in document.\nLooking for: "${preview}"\nTry checking for differences in whitespace, line endings, or formatting.`);
              }
              const originalLineNumberBefore = getLineNumberForPosition(currentContent, insertBeforeIndex);
              currentContent = replaceTextInContent(currentContent, edit.search_text, edit.content + edit.search_text);
              editResults.push(`✓ Edit ${editNumber}: Inserted content before text at line ${originalLineNumberBefore}`);
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
          context.setLabel(t('tools.noteEdit.labels.failed', { name: extractFilenameWithoutExtension(path) }));
          throw error;
        }
      }

      // Write the updated content back to the file
      await plugin.app.vault.modify(file, currentContent);

      // Generate diff output and extract line ranges
      const diffOutput = createPatch(path, originalContent, currentContent, '', '', { context: 5 });
      const { minLine, maxLine } = parseLineRangeFromDiff(diffOutput);
      
      // Create enhanced navigation target with text content
      const navigationTarget: NavigationTarget = {
        filePath: path,
        lineRange: { start: minLine, end: maxLine }
      };

      // Extract text content for the changed lines
      try {
        const lines = currentContent.split('\n');
        const startIndex = Math.max(0, minLine - 1);
        const endIndex = Math.min(lines.length - 1, maxLine - 1);
        const changedText = lines.slice(startIndex, endIndex + 1).join('\n');

        if (changedText.trim()) {
          // For short changes, store full text
          if (endIndex - startIndex + 1 <= 6) {
            navigationTarget.textContent = {
              fullText: changedText,
              preview: changedText.length > 100 ? changedText.substring(0, 100) + '...' : changedText,
              characterCount: changedText.length,
              lineCount: endIndex - startIndex + 1
            };
          } else {
            // For long changes, store start and end portions
            const changedLines = changedText.split('\n');
            const startText = changedLines.slice(0, 3).join('\n');
            const endText = changedLines.slice(-3).join('\n');
            
            navigationTarget.textContent = {
              startText,
              endText,
              preview: (startText + '...' + endText).length > 100 
                ? (startText + '...' + endText).substring(0, 100) + '...' 
                : startText + '...' + endText,
              characterCount: changedText.length,
              lineCount: changedLines.length
            };
          }
        }
      } catch (error) {
        console.warn('Failed to extract text content for navigation target:', error);
      }

      context.addNavigationTarget(navigationTarget);
      
      // Remove the header lines (first 4 lines) to keep just the actual diff
      const diffLines = diffOutput.split('\n');
      const actualDiff = diffLines.slice(4).join('\n').trim();
      
      const contextOutput = actualDiff.length > 0 
        ? `\n\n## ${t('tools.noteEdit.changesMade')}:\n\`\`\`diff\n${actualDiff}\n\`\`\``
        : '';
      
      context.setLabel(t('tools.noteEdit.labels.completed', { name: extractFilenameWithoutExtension(path) }));
      context.progress(`Successfully applied ${edits.length} edit(s) to ${path}:\n\n${editResults.join('\n')}${contextOutput}`);
    } catch (error) {
      context.setLabel(t('tools.noteEdit.labels.failed', { name: extractFilenameWithoutExtension(path) }));
      throw error;
    }
  }
}; 