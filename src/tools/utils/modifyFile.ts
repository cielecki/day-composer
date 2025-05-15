import { TFile, App } from "obsidian";

/**
 * Modifies a file with new content
 * @param file The file to modify
 * @param newContent The new content
 * @param app Obsidian app instance
 * @returns Promise resolving when the file is modified
 */

export async function modifyFile(file: TFile, newContent: string, app: App): Promise<void> {
  await app.vault.modify(file, newContent);
}
