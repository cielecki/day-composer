import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { TFile } from "obsidian";
import { LNMode } from "../utils/mode/LNMode";
import { mergeWithDefaultMode, validateModeSettings, ANTHROPIC_MODELS } from "../utils/mode/ln-mode-defaults";
import { expandLinks } from "../utils/links/expand-links";
import { TTS_VOICES } from "../settings/LifeNavigatorSettings";
import * as yaml from "js-yaml";

const schema = {
  name: "mode_validator",
  description: "Validates a Life Navigator mode file for completeness, correctness, and functionality. Checks frontmatter structure, required attributes, link expansion, and system prompt rendering.",
  input_schema: {
    type: "object",
    properties: {
      mode_path: {
        type: "string",
        description: "The path to the mode file to validate (including .md extension)",
      }
    },
    required: ["mode_path"]
  }
};

type ModeValidatorInput = {
  mode_path: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

export const modeValidatorTool: ObsidianTool<ModeValidatorInput> = {
  specification: schema,
  icon: "shield-check",
  initialLabel: "Validate Mode",
  execute: async (context: ToolExecutionContext<ModeValidatorInput>): Promise<void> => {
    const { plugin, params } = context;
    const { mode_path } = params;

    context.setLabel(`Validating mode: ${mode_path}`);

    try {
      const file = plugin.app.vault.getAbstractFileByPath(mode_path);
      
      if (!file) {
        context.setLabel(`Mode validation failed: ${mode_path}`);
        throw new ToolExecutionError(`File not found: ${mode_path}`);
      }
      
      if (!(file instanceof TFile)) {
        context.setLabel(`Mode validation failed: ${mode_path}`);
        throw new ToolExecutionError(`Path is not a file: ${mode_path}`);
      }

      if (file.extension !== 'md') {
        context.setLabel(`Mode validation failed: ${mode_path}`);
        throw new ToolExecutionError(`Mode files must be markdown files (.md extension): ${mode_path}`);
      }

      const result = await validateModeFile(plugin.app, file);
      
      // Add navigation target
      context.addNavigationTarget({
        filePath: mode_path,
        description: "Open mode file"
      });

      context.setLabel(`Mode validation completed: ${mode_path}`);
      
      // Format the validation report
      let report = `# Mode Validation Report: ${file.basename}\n\n`;
      
      if (result.isValid) {
        report += `✅ **Status: VALID** - Mode passes all validation checks\n\n`;
      } else {
        report += `❌ **Status: INVALID** - Mode has ${result.errors.length} error(s)\n\n`;
      }

      if (result.errors.length > 0) {
        report += `## ❌ Errors (${result.errors.length})\n`;
        result.errors.forEach((error, index) => {
          report += `${index + 1}. ${error}\n`;
        });
        report += '\n';
      }

      if (result.warnings.length > 0) {
        report += `## ⚠️ Warnings (${result.warnings.length})\n`;
        result.warnings.forEach((warning, index) => {
          report += `${index + 1}. ${warning}\n`;
        });
        report += '\n';
      }

      if (result.info.length > 0) {
        report += `## ℹ️ Information (${result.info.length})\n`;
        result.info.forEach((info, index) => {
          report += `${index + 1}. ${info}\n`;
        });
        report += '\n';
      }

      report += `## Validation Summary\n`;
      report += `- **File Path**: ${file.path}\n`;
      report += `- **File Size**: ${file.stat.size} bytes\n`;
      report += `- **Last Modified**: ${new Date(file.stat.mtime).toLocaleString()}\n`;
      report += `- **Errors**: ${result.errors.length}\n`;
      report += `- **Warnings**: ${result.warnings.length}\n`;
      report += `- **Info Items**: ${result.info.length}\n`;

      context.progress(report);
    } catch (error) {
      context.setLabel(`Mode validation failed: ${mode_path}`);
      throw error;
    }
  }
};

async function validateModeFile(app: any, file: TFile): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    info: []
  };

  try {
    // Read file content
    const content = await app.vault.read(file);
    
    if (content.trim().length === 0) {
      result.errors.push("File is empty");
      result.isValid = false;
      return result;
    }

    // Check for ln-mode tag
    const cache = app.metadataCache.getFileCache(file);
    const tags = cache?.tags?.map((tag: any) => tag.tag) || [];
    const frontmatterTags = cache?.frontmatter?.tags || [];
    
    const normalizedFrontmatterTags = Array.isArray(frontmatterTags)
      ? frontmatterTags
      : [frontmatterTags];

    const hasModeTag = tags.includes("#ln-mode") || normalizedFrontmatterTags.includes("ln-mode");
    
    if (!hasModeTag) {
      result.errors.push("File does not have the required 'ln-mode' tag in frontmatter or body");
      result.isValid = false;
    } else {
      result.info.push("File has required 'ln-mode' tag");
    }

    // Parse frontmatter and content
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!frontmatterMatch) {
      result.errors.push("File has no frontmatter. Modes require YAML frontmatter between --- markers");
      result.isValid = false;
      return result;
    }

    const [, frontmatterStr, systemPrompt] = frontmatterMatch;
    
    // Parse YAML frontmatter
    let frontmatter: Record<string, any>;
    try {
      frontmatter = (yaml.load(frontmatterStr) as Record<string, any>) || {};
      result.info.push("Frontmatter YAML parsed successfully");
    } catch (yamlError) {
      result.errors.push(`Invalid YAML in frontmatter: ${yamlError instanceof Error ? yamlError.message : 'Unknown YAML error'}`);
      result.isValid = false;
      return result;
    }

    // Validate system prompt
    if (!systemPrompt || systemPrompt.trim().length === 0) {
      result.warnings.push("System prompt (content after frontmatter) is empty");
    } else {
      result.info.push(`System prompt length: ${systemPrompt.trim().length} characters`);
    }

    // Create partial mode for validation
    const partialMode: Partial<LNMode> = {
      ln_name: file.basename,
      ln_path: file.path,
      ln_system_prompt: systemPrompt.trim(),
      ln_icon: frontmatter.ln_icon,
      ln_icon_color: frontmatter.ln_icon_color,
      ln_description: frontmatter.ln_description,
      ln_example_usages: Array.isArray(frontmatter.ln_example_usages)
        ? frontmatter.ln_example_usages
        : frontmatter.ln_example_usages
          ? [frontmatter.ln_example_usages]
          : [],
      ln_expand_links: frontmatter.ln_expand_links !== undefined
        ? String(frontmatter.ln_expand_links).toLowerCase() === "true"
        : undefined,
      ln_model: frontmatter.ln_model,
      ln_thinking_budget_tokens: frontmatter.ln_thinking_budget_tokens !== undefined
        ? parseInt(String(frontmatter.ln_thinking_budget_tokens))
        : undefined,
      ln_max_tokens: frontmatter.ln_max_tokens !== undefined
        ? parseInt(String(frontmatter.ln_max_tokens))
        : undefined,
      ln_voice_autoplay: frontmatter.ln_voice_autoplay !== undefined
        ? String(frontmatter.ln_voice_autoplay).toLowerCase() === "true"
        : undefined,
      ln_voice: frontmatter.ln_voice,
      ln_voice_instructions: frontmatter.ln_voice_instructions,
      ln_voice_speed: frontmatter.ln_voice_speed !== undefined
        ? parseFloat(String(frontmatter.ln_voice_speed))
        : undefined,
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

    // Merge with defaults to get complete mode
    const completeMode = mergeWithDefaultMode(partialMode);

    // Validate individual fields
    validateModeFields(completeMode, frontmatter, result);

    // Test link expansion if system prompt has links
    if (systemPrompt.includes('[[') && systemPrompt.includes('🔎')) {
      await testLinkExpansion(app, systemPrompt, result);
    } else if (systemPrompt.includes('[[') && !systemPrompt.includes('🔎')) {
      result.info.push("System prompt contains wiki links but no magnifying glass emoji (🔎) - links will not be expanded");
    }

    // Validate using built-in validation
    try {
      const validatedMode = validateModeSettings(completeMode);
      result.info.push("Mode passed built-in validation checks");
    } catch (validationError) {
      result.errors.push(`Built-in validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown validation error'}`);
      result.isValid = false;
    }

  } catch (error) {
    result.errors.push(`Validation failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.isValid = false;
  }

  // Set overall validity
  if (result.errors.length > 0) {
    result.isValid = false;
  }

  return result;
}

function validateModeFields(mode: LNMode, frontmatter: Record<string, any>, result: ValidationResult): void {
  // Validate model
  if (mode.ln_model && mode.ln_model !== "auto" && !ANTHROPIC_MODELS.includes(mode.ln_model as any)) {
    result.warnings.push(`Invalid model "${mode.ln_model}". Valid options: ${ANTHROPIC_MODELS.join(', ')}`);
  } else if (mode.ln_model) {
    result.info.push(`Model: ${mode.ln_model}`);
  }

  // Validate voice
  if (mode.ln_voice && !TTS_VOICES.includes(mode.ln_voice as any)) {
    result.warnings.push(`Invalid voice "${mode.ln_voice}". Valid options: ${TTS_VOICES.join(', ')}`);
  } else if (mode.ln_voice) {
    result.info.push(`Voice: ${mode.ln_voice}`);
  }

  // Validate thinking budget tokens
  if (frontmatter.ln_thinking_budget_tokens !== undefined) {
    const tokens = parseInt(String(frontmatter.ln_thinking_budget_tokens));
    if (isNaN(tokens) || tokens < 1024) {
      result.warnings.push("ln_thinking_budget_tokens should be a number >= 1024");
    } else {
      result.info.push(`Thinking budget: ${tokens} tokens`);
    }
  }

  // Validate max tokens
  if (frontmatter.ln_max_tokens !== undefined) {
    const tokens = parseInt(String(frontmatter.ln_max_tokens));
    if (isNaN(tokens) || tokens <= 0) {
      result.warnings.push("ln_max_tokens should be a positive number");
    } else {
      result.info.push(`Max tokens: ${tokens}`);
    }
  }

  // Validate voice speed
  if (frontmatter.ln_voice_speed !== undefined) {
    const speed = parseFloat(String(frontmatter.ln_voice_speed));
    if (isNaN(speed) || speed <= 0 || speed > 4.0) {
      result.warnings.push("ln_voice_speed should be a number between 0.1 and 4.0");
    } else {
      result.info.push(`Voice speed: ${speed}x`);
    }
  }

  // Validate description
  if (!mode.ln_description || mode.ln_description.trim().length === 0) {
    result.warnings.push("ln_description is missing or empty - this helps users understand what the mode does");
  } else {
    result.info.push(`Description: "${mode.ln_description}"`);
  }

  // Validate icon
  if (!mode.ln_icon) {
    result.warnings.push("ln_icon is missing - mode will use default icon");
  } else {
    result.info.push(`Icon: ${mode.ln_icon}`);
  }

  // Validate example usages
  if (mode.ln_example_usages && mode.ln_example_usages.length > 0) {
    result.info.push(`Example usages: ${mode.ln_example_usages.length} defined`);
  } else {
    result.info.push("No example usages defined");
  }

  // Validate expand links
  if (mode.ln_expand_links !== undefined) {
    result.info.push(`Expand links: ${mode.ln_expand_links}`);
  } else {
    result.info.push("Expand links is undefined");
  }

  // Validate tool filtering
  if (mode.ln_tools_allowed && mode.ln_tools_allowed.length > 0) {
    result.info.push(`Tool allowlist: ${mode.ln_tools_allowed.join(', ')}`);
  }
  
  if (mode.ln_tools_disallowed && mode.ln_tools_disallowed.length > 0) {
    result.info.push(`Tool blocklist: ${mode.ln_tools_disallowed.join(', ')}`);
  }
}

async function testLinkExpansion(app: any, systemPrompt: string, result: ValidationResult): Promise<void> {
  try {
    result.info.push("Testing link expansion in system prompt...");
    const expandedPrompt = await expandLinks(app, systemPrompt);
    
    if (expandedPrompt === systemPrompt) {
      result.warnings.push("System prompt contains links with 🔎 but no expansion occurred - check if linked files exist");
    } else {
      const originalLength = systemPrompt.length;
      const expandedLength = expandedPrompt.length;
      result.info.push(`Link expansion successful: ${originalLength} → ${expandedLength} characters (${expandedLength - originalLength > 0 ? '+' : ''}${expandedLength - originalLength})`);
    }
  } catch (linkError) {
    result.errors.push(`Link expansion failed: ${linkError instanceof Error ? linkError.message : 'Unknown link expansion error'}`);
  }
} 