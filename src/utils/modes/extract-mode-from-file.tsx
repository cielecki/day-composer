import { App, TFile, CachedMetadata, FrontMatterCache } from "obsidian";
import { LNMode } from "../../types/mode";
import { mergeWithDefaultMode, getDefaultLNMode } from "./ln-mode-defaults";

/**
 * Extract LN mode configuration from a markdown file
 * Returns null if the file is not a valid LN mode
 */
export async function extractLNModeFromFile(
	app: App,
	file: TFile,
	metadata?: CachedMetadata | null
): Promise<LNMode | null> {
	try {
		// Get file metadata if not provided
		if (!metadata) {
			metadata = app.metadataCache.getFileCache(file);
		}

		// Check if this is a mode file
		if (!metadata?.frontmatter?.tags?.includes('ln-mode')) {
			return null;
		}

		// Read the file content
		const content = await app.vault.read(file);

		// Parse frontmatter and content
		const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;
		const match = content.match(frontmatterRegex);
		
		if (!match) {
			// No frontmatter - create basic mode from content
			return mergeWithDefaultMode({
				name: file.basename,
				path: file.path,
				system_prompt: content.trim(),
			});
		}

		// Extract content after frontmatter
		const contentStr = content.replace(frontmatterRegex, '').trim();
		const frontmatter = metadata.frontmatter || {};

		// Create partial mode from frontmatter
		// Handle both old (ln_) and new format attributes
		const partialMode: Partial<LNMode> = {
			name: file.basename,
			path: file.path,
			
			// New format attributes
			...(frontmatter.icon && { icon: frontmatter.icon }),
			...(frontmatter.icon_color && { icon_color: frontmatter.icon_color }),
			...(frontmatter.description && { description: frontmatter.description }),
			...(frontmatter.version && { version: frontmatter.version }),
			...(frontmatter.model && { model: frontmatter.model }),
			...(frontmatter.voice && { voice: frontmatter.voice }),
			...(frontmatter.voice_instructions && { voice_instructions: frontmatter.voice_instructions }),
			
			// Old format attributes (for backwards compatibility)
			...(frontmatter.ln_icon && !frontmatter.icon && { icon: frontmatter.ln_icon }),
			...(frontmatter.ln_icon_color && !frontmatter.icon_color && { icon_color: frontmatter.ln_icon_color }),
			...(frontmatter.ln_description && !frontmatter.description && { description: frontmatter.ln_description }),
			...(frontmatter.ln_version && !frontmatter.version && { version: frontmatter.ln_version }),
			...(frontmatter.ln_model && !frontmatter.model && { model: frontmatter.ln_model }),
			...(frontmatter.ln_voice && !frontmatter.voice && { voice: frontmatter.ln_voice }),
			...(frontmatter.ln_voice_instructions && !frontmatter.voice_instructions && { voice_instructions: frontmatter.ln_voice_instructions }),
			
			// Boolean fields (check both old and new format)
			...(frontmatter.enabled !== undefined ? { enabled: String(frontmatter.enabled).toLowerCase() === "true" } : 
				frontmatter.ln_enabled !== undefined ? { enabled: String(frontmatter.ln_enabled).toLowerCase() === "true" } : {}),
			...(frontmatter.expand_links !== undefined ? { expand_links: String(frontmatter.expand_links).toLowerCase() === "true"} : 
				frontmatter.ln_expand_links !== undefined ? { expand_links: String(frontmatter.ln_expand_links).toLowerCase() === "true"} : {}),
			...(frontmatter.voice_autoplay !== undefined ? { voice_autoplay: String(frontmatter.voice_autoplay).toLowerCase() === "true" } : 
				frontmatter.ln_voice_autoplay !== undefined ? { voice_autoplay: String(frontmatter.ln_voice_autoplay).toLowerCase() === "true" } : {}),

			// Handle example_usages (can be string or array, check both formats)
			example_usages: (() => {
				const newFormat = frontmatter.example_usages;
				const oldFormat = frontmatter.ln_example_usages;
				const usages = newFormat || oldFormat;
				
				return Array.isArray(usages) ? usages : usages ? [usages] : [];
			})(),

			// Numeric fields (check both old and new format)
			...(frontmatter.thinking_budget_tokens !== undefined ? { thinking_budget_tokens: parseInt(String(frontmatter.thinking_budget_tokens)) } : 
				frontmatter.ln_thinking_budget_tokens !== undefined ? { thinking_budget_tokens: parseInt(String(frontmatter.ln_thinking_budget_tokens)) } : {}),
			...(frontmatter.max_tokens !== undefined ? { max_tokens: parseInt(String(frontmatter.max_tokens)) } : 
				frontmatter.ln_max_tokens !== undefined ? { max_tokens: parseInt(String(frontmatter.ln_max_tokens)) } : {}),
			...(frontmatter.voice_speed !== undefined ? { voice_speed: parseFloat(String(frontmatter.voice_speed)) } : 
				frontmatter.ln_voice_speed !== undefined ? { voice_speed: parseFloat(String(frontmatter.ln_voice_speed)) } : {}),

			// Tool filtering (check both formats)
			tools_allowed: (() => {
				const newFormat = frontmatter.tools_allowed;
				const oldFormat = frontmatter.ln_tools_allowed;
				const allowed = newFormat || oldFormat;
				
				return Array.isArray(allowed) ? allowed : allowed ? [allowed] : undefined;
			})(),
			tools_disallowed: (() => {
				const newFormat = frontmatter.tools_disallowed;
				const oldFormat = frontmatter.ln_tools_disallowed;
				const disallowed = newFormat || oldFormat;
				
				return Array.isArray(disallowed) ? disallowed : disallowed ? [disallowed] : undefined;
			})(),
		};

		// Set system prompt from content
		partialMode.system_prompt = contentStr;

		// Merge with defaults
		return mergeWithDefaultMode(partialMode);
	} catch (error) {
		console.error(`Error extracting mode from file ${file.path}:`, error);
		return null;
	}
}
