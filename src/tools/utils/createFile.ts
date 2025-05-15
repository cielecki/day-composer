import { App, TFile, normalizePath } from "obsidian";
import { ensureDirectoryExists } from "./ensure-directory-exists";

/**
 * Creates a file at the given path with the provided content
 * Creates parent directories if they don't exist
 * @param path The file path
 * @param content The file content
 * @param app Obsidian app instance
 * @returns Promise resolving to the created file
 */

export async function createFile(path: string, content: string, app: App): Promise<TFile> {
  const normalizedPath = normalizePath(path);

  // Make sure the directory exists
  const directoryPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
  await ensureDirectoryExists(directoryPath, app);

  // Create the file
  return await app.vault.create(normalizedPath, content);
}
