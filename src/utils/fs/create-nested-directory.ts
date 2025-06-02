import { App } from 'obsidian';

/**
 * Recursively creates nested directories, ensuring parent directories exist first
 * @param app Obsidian app instance
 * @param dirPath Directory path to create
 */
export const createNestedDirectory = async (app: App, dirPath: string): Promise<void> => {
	if (!dirPath || dirPath === '.' || dirPath === '/') return;

	// Normalize the path to use forward slashes consistently
	const normalizedPath = dirPath.replace(/\\/g, '/');

	// Check if directory already exists
	if (app.vault.getAbstractFileByPath(normalizedPath)) {
		return;
	}

	// Get parent directory
	const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));

	// Recursively create parent directory if it doesn't exist and has a valid path
	if (parentDir && parentDir !== normalizedPath) {
		await createNestedDirectory(app, parentDir);
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
};
