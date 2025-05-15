import { formatNode } from "./formatNode";
import { Note } from "./note-utils";

/**
 * Format a structured document back to markdown
 * @param document The document to format
 * @returns Markdown string representation
 */

export function formatMarkdown(document: Note): string {
  return document.content.map(formatNode).join('\n');
}
