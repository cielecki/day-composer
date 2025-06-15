import { App, TFile, TFolder } from "obsidian";

/**
 * Helper function to resolve a link path to a file
 * @param app The Obsidian App instance
 * @param linkpath The link path to resolve
 * @returns The resolved TFile or null if not found
 */
export function resolveLinkToFile(app: App, linkpath: string): TFile | null {
	// Try to resolve the link using Obsidian's API
	// @ts-ignore: Using private API
	if (app.metadataCache.getFirstLinkpathDest) {
		// @ts-ignore: Using private API
		return app.metadataCache.getFirstLinkpathDest(linkpath, "");
	}

	// Fallback: manual resolution
	return (
		app.vault
			.getFiles()
			.find(
				(file) =>
					file.path === linkpath || file.basename === linkpath,
			) || null
	);
}

/**
 * Helper function to resolve a link path to a folder
 * @param app The Obsidian App instance
 * @param linkpath The link path to resolve
 * @returns The resolved TFolder or null if not found
 */
export function resolveLinkToFolder(app: App, linkpath: string): TFolder | null {
	// Get all folders in the vault
	const folders = app.vault.getAllLoadedFiles().filter(
		(file): file is TFolder => file instanceof TFolder
	);

	// Try to find folder by exact path match first
	let folder = folders.find(f => f.path === linkpath);
	if (folder) return folder;

	// Try to find folder by name match
	folder = folders.find(f => f.name === linkpath);
	if (folder) return folder;

	// Try to find folder by partial path match (for nested folders)
	folder = folders.find(f => f.path.endsWith('/' + linkpath) || f.path.endsWith(linkpath));
	if (folder) return folder;

	return null;
}

/**
 * Helper function to resolve a link path to either a file or folder
 * @param app The Obsidian App instance
 * @param linkpath The link path to resolve
 * @returns The resolved TFile, TFolder, or null if not found
 */
export function resolveLinkToFileOrFolder(app: App, linkpath: string): TFile | TFolder | null {
	// Try to resolve as file first
	const file = resolveLinkToFile(app, linkpath);
	if (file) return file;

	// If not found as file, try to resolve as folder
	const folder = resolveLinkToFolder(app, linkpath);
	if (folder) return folder;

	return null;
} 