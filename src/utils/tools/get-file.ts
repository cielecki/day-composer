import { App, TFile, normalizePath } from "obsidian";

/**
 * Gets a file at the given path if it exists
 * @param path The file path
 * @param app Obsidian app instance
 * @returns The file if found, null otherwise
 */

export function getFile(path: string, app: App): TFile | null {
  const normalizedPath = normalizePath(path);
  const file = app.vault.getAbstractFileByPath(normalizedPath);

  if (!file || !(file instanceof TFile)) {
    return null;
  }

  return file;
}
