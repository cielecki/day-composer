import { App } from "obsidian";

/**
 * Ensures directory exists, creating it if needed
 * @param path Directory path
 * @param app Obsidian app instance
 */
export async function ensureDirectoryExists(path: string, app: App): Promise<void> {
    if (!path || path === '/') return;
    
    // Check if the directory exists
    const exists = await app.vault.adapter.exists(path);
    
    if (!exists) {
        // Create the directory
        await app.vault.createFolder(path);
    }
}
