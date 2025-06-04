import { formatTask } from 'src/utils/tasks/task-utils';
import { NoteNode } from 'src/utils/tools/note-utils';

/**
 * Format a document node to markdown
 * @param node The node to format
 * @returns Markdown string representation
 */
export function formatNode(node: NoteNode): string {
  switch (node.type) {
    case 'task':
      return formatTask(node);
    case 'text':
      return node.content;
    default:
      return '';
  }
}
