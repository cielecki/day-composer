import { TFile, CachedMetadata, FrontMatterCache } from "obsidian";
import { LNMode } from "../../types/mode";
import { TTS_VOICES, TTSVoice } from "src/store/audio-slice";
import { ANTHROPIC_MODELS, AnthropicModel } from "../modes/ln-mode-defaults";
import { validateIconField } from "./lucide-icon-validation";
import { expandLinks } from "../links/expand-links";
import { LifeNavigatorPlugin } from "../../LifeNavigatorPlugin";

export interface ModeValidationResult {
	isValid: boolean;
	issues: ModeValidationIssue[];
}

export interface ModeValidationIssue {
	type: 'old_format' | 'missing_required_field' | 'invalid_field_value' | 'invalid_structure';
	field?: string;
	message: string;
	severity: 'error' | 'warning';
}

/**
 * Validates a mode file and returns all detected issues
 */
export async function validateModeFile(
	file: TFile,
	metadata: CachedMetadata | null,
	content?: string
): Promise<ModeValidationResult> {
	const issues: ModeValidationIssue[] = [];
	
	// Check if this has the required ln-mode tag
	const hasLnModeTag = metadata?.frontmatter?.tags?.includes('ln-mode');
	if (!hasLnModeTag) {
		return { 
			isValid: false, 
			issues: [{
				type: 'missing_required_field',
				field: 'tags',
				message: 'Missing required ln-mode tag in frontmatter',
				severity: 'error'
			}] 
		};
	}
	
	const frontmatter = metadata?.frontmatter || {};
	
	// Check for old formats
	const oldLnKeys = Object.keys(frontmatter).filter(key => key.startsWith('ln_'));
	const hasLifeNavigatorSection = frontmatter.life_navigator !== undefined;
	
	// Check for version format issues
	const version = frontmatter.version;
	const hasVersionFormatIssue = version && typeof version === 'string' && 
		version.trim().startsWith('v') && /^v\d+\.\d+\.\d+/.test(version.trim());
	
	// Check for boolean format issues (yes/no instead of true/false)
	const booleanFields = ['enabled', 'voice_autoplay', 'expand_links'];
	const hasBooleanFormatIssues = booleanFields.some(field => {
		if (frontmatter[field] !== undefined) {
			const value = String(frontmatter[field]).toLowerCase();
			return value === 'yes' || value === 'no';
		}
		return false;
	});
	
	if (oldLnKeys.length > 0) {
		issues.push({
			type: 'old_format',
			message: `Uses old ln_ format attributes: ${oldLnKeys.join(', ')}`,
			severity: 'error'
		});
	}
	
	if (hasLifeNavigatorSection) {
		issues.push({
			type: 'old_format',
			message: 'Uses old life_navigator: section format - attributes should be at root level',
			severity: 'error'
		});
	}
	
	if (hasVersionFormatIssue) {
		const versionStr = version.trim();
		issues.push({
			type: 'old_format',
			message: `Version format '${versionStr}' should not include 'v' prefix. Use '${versionStr.substring(1)}' instead.`,
			severity: 'error'
		});
	}
	
	if (hasBooleanFormatIssues) {
		const problemFields = booleanFields.filter(field => {
			if (frontmatter[field] !== undefined) {
				const value = String(frontmatter[field]).toLowerCase();
				return value === 'yes' || value === 'no';
			}
			return false;
		});
		issues.push({
			type: 'old_format',
			message: `Boolean fields use old format: ${problemFields.join(', ')}. Use 'true' or 'false' instead of 'yes' or 'no'.`,
			severity: 'error'
		});
	}
	
	const isOldFormat = oldLnKeys.length > 0 || hasLifeNavigatorSection || hasVersionFormatIssue || hasBooleanFormatIssues;
	
	// For new format modes, check required fields and validate known attributes
	if (!isOldFormat) {
		// Required fields
		if (!frontmatter.description) {
			issues.push({
				type: 'missing_required_field',
				field: 'description',
				message: 'Missing required field: description',
				severity: 'error'
			});
		}
		
		// Recommended fields
		if (!frontmatter.icon) {
			issues.push({
				type: 'missing_required_field',
				field: 'icon',
				message: 'Missing recommended field: icon',
				severity: 'warning'
			});
		}
		
		// Validate known attributes and flag unknown ones
		const validAttributes = new Set([
			'tags', 'icon', 'icon_color', 'description', 'model', 'thinking_budget_tokens',
			'max_tokens', 'voice_autoplay', 'voice', 'voice_instructions', 'tools_allowed',
			'tools_disallowed', 'example_usages', 'enabled', 'version', 'expand_links'
		]);
		
		const unknownAttributes = Object.keys(frontmatter).filter(key => !validAttributes.has(key));
		if (unknownAttributes.length > 0) {
			issues.push({
				type: 'invalid_structure',
				message: `Unknown attributes found: ${unknownAttributes.join(', ')}`,
				severity: 'warning'
			});
		}
		
		// Validate specific field values
		if (frontmatter.model !== undefined) {
			if (typeof frontmatter.model !== 'string') {
				issues.push({
					type: 'invalid_field_value',
					field: 'model',
					message: 'model must be a string',
					severity: 'error'
				});
			} else {
				const validModels = ANTHROPIC_MODELS;
				if (!validModels.includes(frontmatter.model as AnthropicModel)) {
					issues.push({
						type: 'invalid_field_value',
						field: 'model',
						message: `Invalid model: ${frontmatter.model}. Valid options: ${validModels.join(', ')}`,
						severity: 'warning'
					});
				}
			}
		}
		
		// Validate voice parameter
		if (frontmatter.voice !== undefined) {
			if (typeof frontmatter.voice !== 'string') {
				issues.push({
					type: 'invalid_field_value',
					field: 'voice',
					message: 'voice must be a string',
					severity: 'error'
				});
			} else {
				const validVoices = TTS_VOICES;
				if (!validVoices.includes(frontmatter.voice as TTSVoice)) {
					issues.push({
						type: 'invalid_field_value',
						field: 'voice',
						message: `Invalid voice: ${frontmatter.voice}. Valid OpenAI voices: ${validVoices.join(', ')}`,
						severity: 'error'
					});
				}
			}
		}
		
		// Validate voice_id parameter (same as voice, some modes use this)
		if (frontmatter.voice_id !== undefined) {
			if (typeof frontmatter.voice_id !== 'string') {
				issues.push({
					type: 'invalid_field_value',
					field: 'voice_id',
					message: 'voice_id must be a string',
					severity: 'error'
				});
			} else {
				const validVoices = TTS_VOICES;
				if (!validVoices.includes(frontmatter.voice_id as TTSVoice)) {
					issues.push({
						type: 'invalid_field_value',
						field: 'voice_id',
						message: `Invalid voice_id: ${frontmatter.voice_id}. Valid OpenAI voices: ${validVoices.join(', ')}`,
						severity: 'error'
					});
				}
			}
		}
		
		// Validate description type
		if (frontmatter.description !== undefined && typeof frontmatter.description !== 'string') {
			issues.push({
				type: 'invalid_field_value',
				field: 'description',
				message: 'description must be a string',
				severity: 'error'
			});
		}
		
		// Validate icon field (type and validity)
		if (frontmatter.icon !== undefined) {
			const iconValidation = validateIconField(frontmatter.icon, 'icon', false);
			if (!iconValidation.isValid && iconValidation.issue) {
				issues.push(iconValidation.issue);
			}
		}
		
		// Validate icon_color type
		if (frontmatter.icon_color !== undefined && typeof frontmatter.icon_color !== 'string') {
			issues.push({
				type: 'invalid_field_value',
				field: 'icon_color',
				message: 'icon_color must be a string',
				severity: 'error'
			});
		}
		
		// Validate voice_instructions type
		if (frontmatter.voice_instructions !== undefined && typeof frontmatter.voice_instructions !== 'string') {
			issues.push({
				type: 'invalid_field_value',
				field: 'voice_instructions',
				message: 'voice_instructions must be a string',
				severity: 'error'
			});
		}
		
		// Validate token limits
		if (frontmatter.max_tokens !== undefined) {
			const maxTokens = Number(frontmatter.max_tokens);
			if (isNaN(maxTokens) || maxTokens < 1) {
				issues.push({
					type: 'invalid_field_value',
					field: 'max_tokens',
					message: 'max_tokens must be a positive number',
					severity: 'warning'
				});
			}
		}

		if (frontmatter.thinking_budget_tokens !== undefined) {
			const thinkingTokens = Number(frontmatter.thinking_budget_tokens);
			const maxTokens = frontmatter.max_tokens ? Number(frontmatter.max_tokens) : 8192;
			
			if (isNaN(thinkingTokens) || thinkingTokens < 1024 || thinkingTokens > maxTokens) {
				issues.push({
					type: 'invalid_field_value',
					field: 'thinking_budget_tokens',
					message: `thinking_budget_tokens must be a number between 1024 and ${maxTokens}`,
					severity: 'warning'
				});
			}
		}
		// Validate boolean fields
		const booleanFields = ['voice_autoplay', 'enabled', 'expand_links'];
		for (const field of booleanFields) {
			if (frontmatter[field] !== undefined) {
				const value = String(frontmatter[field]).toLowerCase();
				if (value !== 'true' && value !== 'false') {
					issues.push({
						type: 'invalid_field_value',
						field: field,
						message: `${field} must be true or false`,
						severity: 'warning'
					});
				}
			}
		}
		
		// Validate array fields
		const arrayFields = ['tools_allowed', 'tools_disallowed', 'example_usages'];
		for (const field of arrayFields) {
			if (frontmatter[field] !== undefined && !Array.isArray(frontmatter[field])) {
				issues.push({
					type: 'invalid_field_value',
					field: field,
					message: `${field} must be an array`,
					severity: 'warning'
				});
			}
		}
	}
	
	// Check for invalid field values
	if (frontmatter.enabled !== undefined) {
		const enabledStr = String(frontmatter.enabled).toLowerCase();
		if (enabledStr !== 'true' && enabledStr !== 'false') {
			issues.push({
				type: 'invalid_field_value',
				field: 'enabled',
				message: 'enabled field must be true or false',
				severity: 'warning'
			});
		}
	}
	
	if (frontmatter.max_tokens !== undefined) {
		const maxTokens = parseInt(String(frontmatter.max_tokens));
		if (isNaN(maxTokens) || maxTokens <= 0) {
			issues.push({
				type: 'invalid_field_value',
				field: 'max_tokens',
				message: 'max_tokens must be a positive number',
				severity: 'warning'
			});
		}
	}
	
	if (frontmatter.voice_speed !== undefined) {
		const voiceSpeed = parseFloat(String(frontmatter.voice_speed));
		if (isNaN(voiceSpeed) || voiceSpeed < 0.25 || voiceSpeed > 4.0) {
			issues.push({
				type: 'invalid_field_value',
				field: 'voice_speed',
				message: 'voice_speed must be between 0.25 and 4.0',
				severity: 'warning'
			});
		}
	}
	
	// Check content structure
	if (content !== undefined) {
		const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;
		const contentAfterFrontmatter = content.replace(frontmatterRegex, '').trim();
		
		// Check for old link formats (🔎 instead of 🧭)
		const hasOldLinkFormat = /\]\]\s*🔎/.test(contentAfterFrontmatter);
		if (hasOldLinkFormat) {
			issues.push({
				type: 'old_format',
				message: 'Content uses old link expansion format (🔎). Consider updating to new format (🧭) for consistency, though 🔎 still works.',
				severity: 'warning'
			});
		}
		
		if (!contentAfterFrontmatter) {
			issues.push({
				type: 'invalid_structure',
				message: 'Mode file has no system prompt content after frontmatter',
				severity: 'warning'
			});
		} else {
			// Test system prompt generation if expand_links is enabled
			const expandLinksEnabled = frontmatter.expand_links !== undefined 
				? String(frontmatter.expand_links).toLowerCase() === 'true'
				: true; // Default is true
			
			if (expandLinksEnabled) {
				try {
					const plugin = LifeNavigatorPlugin.getInstance();
					if (plugin) {
						// Test link expansion to catch errors similar to "View system prompt" button
						await expandLinks(plugin.app, contentAfterFrontmatter);
					}
				} catch (error) {
					// Errors during link expansion (e.g., unresolved links, missing files)
					const errorMessage = error instanceof Error ? error.message : String(error);
					issues.push({
						type: 'invalid_structure',
						message: `System prompt generation failed: ${errorMessage}`,
						severity: 'error'
					});
				}
			}
		}
	}
	
	const hasErrors = issues.some(issue => issue.severity === 'error');
	
	return {
		isValid: !hasErrors,
		issues
	};
}

/**
 * Quick check if a mode has old format (for backwards compatibility)
 */
export function hasOldFormat(frontmatter: FrontMatterCache): boolean {
	if (!frontmatter) return false;
	return Object.keys(frontmatter).some(key => key.startsWith('ln_'));
} 