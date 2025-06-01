import { App, TFile } from "obsidian";

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