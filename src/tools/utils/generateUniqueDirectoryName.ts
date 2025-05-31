import { App, normalizePath } from "obsidian";

/**
 * Generates a unique directory name by appending a number suffix if the directory already exists
 * @param app Obsidian app instance
 * @param baseName Base directory name
 * @returns Promise<string> Unique directory name
 */
export async function generateUniqueDirectoryName(app: App, baseName: string): Promise<string> {
  let directoryName = baseName;
  let counter = 2;

  // Check if the base directory exists
  while (app.vault.getAbstractFileByPath(directoryName)) {
    directoryName = `${baseName} ${counter}`;
    counter++;
  }

  return directoryName;
} 