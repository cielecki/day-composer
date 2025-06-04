import * as yaml from "js-yaml";
import { App, TFile } from "obsidian";
import { t } from 'src/i18n';
import { mergeWithDefaultMode } from 'src/utils/modes/ln-mode-defaults';
import { LNMode } from "src/types/LNMode";

// Function to extract an LN mode from a file with the #ln-mode tag
export const extractLNModeFromFile = async (
	app: App,
	file: TFile
): Promise<LNMode | null> => {
	try {
		const content = await app.vault.read(file);

		// Check if content is valid
		if (content.trim().length === 0) {
			return null;
		}

		// Check if file has #ln-mode tag
		const cache = app.metadataCache.getFileCache(file);
		const tags = cache?.tags?.map((tag) => tag.tag) || [];
		const frontmatterTags = cache?.frontmatter?.tags || [];

		// Convert frontmatter tags to array if it's a string
		const normalizedFrontmatterTags = Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];

		// Check if the file has the #ln-mode tag
		const hasModeTag = tags.includes("#ln-mode") ||
			normalizedFrontmatterTags.includes("ln-mode");

		if (!hasModeTag) {
			return null;
		}

		// Parse frontmatter and content
		const frontmatterMatch = content.match(
			/^---\n([\s\S]*?)\n---\n([\s\S]*)$/
		);

		if (!frontmatterMatch) {
			console.warn(
				t('ui.mode.files.noFrontmatter').replace('{{filename}}', file.name)
			);
			// Create partial mode with only required fields
			const partialMode: Partial<LNMode> = {
				ln_name: file.basename,
				ln_path: file.path,
				ln_system_prompt: content.trim(),
			};

			// Merge with defaults
			return mergeWithDefaultMode(partialMode);
		}

		const [, frontmatterStr, contentStr] = frontmatterMatch;

		// Parse frontmatter using js-yaml
		let frontmatter: Record<string, any>;
		try {
			frontmatter =
				(yaml.load(frontmatterStr) as Record<string, any>) || {};
		} catch (yamlError) {
			console.error(`Error parsing YAML in ${file.path}:`, yamlError);
			frontmatter = {};
		}
		// Create a partial LNMode object
		const partialMode: Partial<LNMode> = {
			// Required fields
			ln_name: file.basename,
			ln_path: file.path,

			// UI elements
			ln_icon: frontmatter.ln_icon,
			ln_icon_color: frontmatter.ln_icon_color,
			ln_description: frontmatter.ln_description,

			// Common attributes (shared with tools)
			ln_version: frontmatter.ln_version,
			...(frontmatter.ln_enabled !== undefined ? { ln_enabled: String(frontmatter.ln_enabled).toLowerCase() === "true" } : {}),

			// Behavior
			ln_example_usages: Array.isArray(
				frontmatter.ln_example_usages
			)
				? frontmatter.ln_example_usages
				: frontmatter.ln_example_usages
					? [frontmatter.ln_example_usages]
					: [],

			...(frontmatter.ln_expand_links !== undefined ? { ln_expand_links: String(frontmatter.ln_expand_links).toLowerCase() === "true"}: {}),

			// API parameters
			ln_model: frontmatter.ln_model,
			...(frontmatter.ln_thinking_budget_tokens !== undefined ? { ln_thinking_budget_tokens: parseInt(String(frontmatter.ln_thinking_budget_tokens)) } : {}),
			...(frontmatter.ln_max_tokens !== undefined ? { ln_max_tokens: parseInt(String(frontmatter.ln_max_tokens)) } : {}),

			// TTS settings
			...(frontmatter.ln_voice_autoplay !== undefined ? { ln_voice_autoplay: String(frontmatter.ln_voice_autoplay).toLowerCase() === "true" } : {}),
			ln_voice: frontmatter.ln_voice,
			ln_voice_instructions: frontmatter.ln_voice_instructions,
			...(frontmatter.ln_voice_speed !== undefined ? { ln_voice_speed: parseFloat(String(frontmatter.ln_voice_speed)) } : {}),

			// Tool filtering
			ln_tools_allowed: Array.isArray(frontmatter.ln_tools_allowed)
				? frontmatter.ln_tools_allowed
				: frontmatter.ln_tools_allowed
					? [frontmatter.ln_tools_allowed]
					: undefined,
			ln_tools_disallowed: Array.isArray(frontmatter.ln_tools_disallowed)
				? frontmatter.ln_tools_disallowed
				: frontmatter.ln_tools_disallowed
					? [frontmatter.ln_tools_disallowed]
					: undefined,
		};

		partialMode.ln_system_prompt = contentStr;

		// Merge with defaults and return
		return mergeWithDefaultMode(partialMode);
	} catch (error) {
		console.error(`Error reading file ${file.path}:`, error);
		return null;
	}
};
