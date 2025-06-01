import { App, normalizePath } from "obsidian";

/**
 * Generates a unique file name by appending a number suffix if the file already exists
 * @param app Obsidian app instance
 * @param basePath Base file path including extension
 * @returns Promise<string> Unique file path
 */
export async function generateUniqueFileName(app: App, basePath: string): Promise<string> {
  const normalizedPath = normalizePath(basePath);
  
  // Check if the base file exists
  if (!app.vault.getAbstractFileByPath(normalizedPath)) {
    return normalizedPath;
  }

  // Extract directory, filename without extension, and extension
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  const directory = lastSlashIndex >= 0 ? normalizedPath.substring(0, lastSlashIndex + 1) : '';
  const fileNameWithExt = lastSlashIndex >= 0 ? normalizedPath.substring(lastSlashIndex + 1) : normalizedPath;
  
  const lastDotIndex = fileNameWithExt.lastIndexOf('.');
  const fileName = lastDotIndex >= 0 ? fileNameWithExt.substring(0, lastDotIndex) : fileNameWithExt;
  const extension = lastDotIndex >= 0 ? fileNameWithExt.substring(lastDotIndex) : '';

  // Find a unique filename by incrementing a number
  let counter = 2;
  let uniquePath: string;

  do {
    const uniqueFileName = `${fileName} ${counter}${extension}`;
    uniquePath = directory + uniqueFileName;
    counter++;
  } while (app.vault.getAbstractFileByPath(uniquePath));

  return uniquePath;
} 