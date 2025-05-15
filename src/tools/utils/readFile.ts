import { TFile, App } from "obsidian";

/**
 * Reads the content of a file
 * @param file The file to read
 * @param app Obsidian app instance
 * @returns Promise resolving to the file content
 */

export async function readFile(file: TFile, app: App): Promise<string> {
  return await app.vault.read(file);
}
