import { App } from "obsidian";

/**
 * Ensures directory exists, creating it if needed
 * Handles nested directories by creating them recursively
 * @param path Directory path
 * @param app Obsidian app instance
 */
export async function ensureDirectoryExists(path: string, app: App): Promise<void> {
    if (!path || path === '/' || path === '.') return;
    
    // Normalize the path to use forward slashes consistently
    const normalizedPath = path.replace(/\\/g, '/');
    
    // Check if the directory exists
    if (app.vault.getAbstractFileByPath(normalizedPath)) {
        return;
    }

    // Get parent directory
    const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
    
    // Recursively create parent directory if it doesn't exist and has a valid path
    if (parentDir && parentDir !== normalizedPath) {
        await ensureDirectoryExists(parentDir, app);
    }

    // Create this directory only if it doesn't exist
    if (!app.vault.getAbstractFileByPath(normalizedPath)) {
        try {
            await app.vault.createFolder(normalizedPath);
        } catch (error) {
            // If folder already exists, that's fine - continue
            if (error.message && error.message.includes('already exists')) {
                return;
            }
            throw error;
        }
    }
}
