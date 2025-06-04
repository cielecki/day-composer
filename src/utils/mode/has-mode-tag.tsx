import { App, TFile } from "obsidian";
import { LifeNavigatorPlugin } from "src/LifeNavigatorPlugin";

// Helper to check if file has or had the #ln-mode tag
export function hasModeTag(file: TFile): boolean {
	const cache = LifeNavigatorPlugin.getInstance().app.metadataCache.getFileCache(file);
	const tags = cache?.tags?.map((tag) => tag.tag) || [];
	const frontmatterTags = cache?.frontmatter?.tags || [];

	// Convert frontmatter tags to array if it's a string
	const normalizedFrontmatterTags = Array.isArray(frontmatterTags)
		? frontmatterTags
		: [frontmatterTags];

	return (
		tags.includes("#ln-mode") ||
		normalizedFrontmatterTags.includes("ln-mode")
	);
}
