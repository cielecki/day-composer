import { escapeRegExp } from "./escape-reg-exp";

/**
 * Utility functions for working with todo items
 */
/**
 * Finds a todo item in a document by its text
 * @param content The document content
 * @param todoText The text of the todo item to find
 * @returns The RegExp object for the todo pattern
 */

export function createTodoPattern(todoText: string): RegExp {
  // This regex matches both checked and unchecked to-do items
  return new RegExp(`(- \\[[ x]\\]\\s*(?:\\([^)]*\\))?\\s*${escapeRegExp(todoText)})(?:\n(?:>[^\n]+\n)*)?`, 'gm');
}
