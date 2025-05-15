import { App, normalizePath } from "obsidian";

/**
 * Utility functions for file operations
 */
/**
 * Checks if a file exists at the given path
 * @param path The file path to check
 * @param app Obsidian app instance
 * @returns Promise resolving to true if the file exists, false otherwise
 */

export async function fileExists(path: string, app: App): Promise<boolean> {
  const normalizedPath = normalizePath(path);
  return await app.vault.adapter.exists(normalizedPath);
}
