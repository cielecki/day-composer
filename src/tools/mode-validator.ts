import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { TFile } from "obsidian";
import { validateModeFile, ModeValidationResult } from '../utils/validation/mode-validation';
import { validateToolFile, ToolValidationResult } from '../utils/validation/tool-validation';
import { extractFilenameWithoutExtension } from '../utils/text/string-sanitizer';

/**
 * Analyze content for old special link syntax that could be migrated
 */
function analyzeContentForMigrations(content: string): { migrationOpportunities: Array<{pattern: string, replacement: string, description: string, matches: Array<{original: string, replacement: string}>}>, totalCount: number } {
  const migrationOpportunities = [];
  let totalCount = 0;
  
  // Migration patterns: old syntax -> new syntax (with backticks)
  const migrations = [
    // Day note links: [[ln-day-note-(X)]] 🧭 -> `🧭 daily_note(X)`
    {
      pattern: /\[\[ln-day-note-\(([+-]?\d+)\)\]\]\s*🧭/g,
      replacement: '`🧭 daily_note($1)`',
      description: 'day note links'
    },
    // Day note range links: [[ln-day-note-(X:Y)]] 🧭 -> `🧭 daily_notes(X, Y)`
    {
      pattern: /\[\[ln-day-note-\(([+-]?\d+):([+-]?\d+)\)\]\]\s*🧭/g,
      replacement: '`🧭 daily_notes($1, $2)`',
      description: 'day note range links'
    },
    // Current date and time: [[ln-current-date-and-time]] 🧭 -> `🧭 current_date_time()`
    {
      pattern: /\[\[ln-current-date-and-time\]\]\s*🧭/g,
      replacement: '`🧭 current_date_time()`',
      description: 'current date/time links'
    },
    // Currently open file: [[ln-currently-open-file]] 🧭 -> `🧭 current_file_and_selection()`
    {
      pattern: /\[\[ln-currently-open-file\]\]\s*🧭/g,
      replacement: '`🧭 current_file_and_selection()`',
      description: 'currently open file links'
    },
    // Currently selected text: [[ln-currently-selected-text]] 🧭 -> `🧭 current_file_and_selection()`
    {
      pattern: /\[\[ln-currently-selected-text\]\]\s*🧭/g,
      replacement: '`🧭 current_file_and_selection()`',
      description: 'currently selected text links'
    },
    // Current chat: [[ln-current-chat]] 🧭 -> `🧭 current_chat()`
    {
      pattern: /\[\[ln-current-chat\]\]\s*🧭/g,
      replacement: '`🧭 current_chat()`',
      description: 'current chat links'
    },

    // Old compass format without backticks: 🧭 tool_name(params) -> `🧭 tool_name(params)`
    {
      pattern: /(?<!`)🧭\s+([a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\))(?!`)/g,
      replacement: '`🧭 $1`',
      description: 'compass format without backticks'
    },
    // Old expand format without backticks: 🧭 expand [[link]] -> `🧭 expand` [[link]]
    {
      pattern: /(?<!`)🧭\s+expand(?!`)\s+(\[\[[^\]]+\]\])/g,
      replacement: '`🧭 expand` $1',
      description: 'expand format without backticks'
    },
    // Old 🔎 format: [[ln-*]] 🔎 -> appropriate new format
    {
      pattern: /\[\[ln-([^\]]+)\]\]\s*🔎/g,
      replacement: '`🧭 expand` [[ln-$1]]',
      description: 'deprecated 🔎 format links'
    },
    // Old compass format for regular links: [[file]] 🧭 -> `🧭 expand` [[file]]
    {
      pattern: /\[\[([^\]]+)\]\]\s*🧭/g,
      replacement: '`🧭 expand` [[$1]]',
      description: 'regular link expansion without backticks'
    }
  ];
  
  for (const migration of migrations) {
    const matches = [...content.matchAll(migration.pattern)];
    if (matches.length > 0) {
      // Store individual match data with proper replacements
      const matchData = matches.map(match => {
        let replacement = migration.replacement;
        // Replace placeholders like $1, $2, etc.
        for (let i = 1; i < match.length; i++) {
          replacement = replacement.replace(`$${i}`, match[i]);
        }
        return {
          original: match[0],
          replacement: replacement
        };
      });
      
      migrationOpportunities.push({
        pattern: migration.pattern.source,
        replacement: migration.replacement,
        description: migration.description,
        matches: matchData
      });
      totalCount += matches.length;
    }
  }
  
  return { migrationOpportunities, totalCount };
}

const schema = {
  name: "mode_validator",
  description: "Validates Life Navigator mode and tool files for completeness, correctness, and functionality. Checks frontmatter structure, required attributes, identifies common issues, and analyzes content for migration opportunities. Read-only tool that provides analysis without modifying files.",
  input_schema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "The path to the mode or tool file to validate (including .md extension)",
      },
      type: {
        type: "string",
        enum: ["mode", "tool", "auto"],
        description: "Type of file to validate. Use 'auto' to detect automatically based on tags.",
        default: "auto"
      }
    },
    required: ["file_path"]
  }
};

type ModeValidatorInput = {
  file_path: string;
  type?: "mode" | "tool" | "auto";
}

export const modeValidatorTool: ObsidianTool<ModeValidatorInput> = {
  specification: schema,
  icon: "shield-check",
  sideEffects: false, // Read-only validation and analysis tool
  get initialLabel() {
    return t('tools.modeValidator.labels.initial');
  },
  execute: async (context: ToolExecutionContext<ModeValidatorInput>): Promise<void> => {
    const { plugin, params } = context;
    const { file_path, type = "auto" } = params;

    context.setLabel(t('tools.modeValidator.labels.inProgress', { fileName: extractFilenameWithoutExtension(file_path) }));

    try {
      const file = plugin.app.vault.getAbstractFileByPath(file_path);
      
      if (!file) {
        context.setLabel(t('tools.modeValidator.labels.failed', { fileName: extractFilenameWithoutExtension(file_path) }));
        throw new ToolExecutionError(`File not found: ${file_path}`);
      }
      
              if (!(file instanceof TFile)) {
          context.setLabel(t('tools.modeValidator.labels.failed', { fileName: extractFilenameWithoutExtension(file_path) }));
          throw new ToolExecutionError(`Path is not a file: ${file_path}`);
        }

              if (file.extension !== 'md') {
          context.setLabel(t('tools.modeValidator.labels.failed', { fileName: extractFilenameWithoutExtension(file_path) }));
          throw new ToolExecutionError(`Files must be markdown files (.md extension): ${file_path}`);
        }

      // Get metadata and content
      const metadata = plugin.app.metadataCache.getFileCache(file);
      const content = await plugin.app.vault.read(file);
      
      // Determine file type
      let fileType = type;
      if (type === "auto") {
        const tags = metadata?.frontmatter?.tags || [];
        const normalizedTags = Array.isArray(tags) ? tags : [tags];
        
        if (normalizedTags.includes("ln-mode")) {
          fileType = "mode";
        } else if (normalizedTags.includes("ln-tool")) {
          fileType = "tool";
        } else {
          context.setLabel(t('tools.modeValidator.labels.failed', { fileName: extractFilenameWithoutExtension(file_path) }));
          throw new ToolExecutionError(`Could not determine file type. File must have 'ln-mode' or 'ln-tool' tag.`);
        }
      }
      
      // Analyze content for old format usage (now treated as errors)
      const migrationAnalysis = analyzeContentForMigrations(content);
      
      // Validate based on type
      let result: ModeValidationResult | ToolValidationResult;
      if (fileType === "mode") {
        result = await validateModeFile(file, metadata, content);
      } else {
        result = await validateToolFile(plugin.app, file, metadata, content);
      }
      
      // Add old format usage as validation errors
      if (migrationAnalysis.totalCount > 0) {
        context.progress(`Found ${migrationAnalysis.totalCount} old format link(s) that must be updated`);
        
        for (const opportunity of migrationAnalysis.migrationOpportunities) {
          for (const match of opportunity.matches) {
            result.issues.push({
              type: 'old_format',
              severity: 'error',
              message: `Old Life Navigator link format is no longer supported: ${match.original}. Use new format: ${match.replacement}`,
              field: 'content'
            });
          }
        }
        
        // Mark as invalid if old format is found
        result.isValid = false;
      }
      
      // Add navigation target
      context.addNavigationTarget({
        filePath: file_path
      });

      // Set completion label with issue counts
      const errorCount = result.issues.filter(issue => issue.severity === 'error').length;
      const warningCount = result.issues.filter(issue => issue.severity === 'warning').length;
      
      const labelContent = fileType === "mode" ? t('validation.results.mode.completed', { 
        filePath: extractFilenameWithoutExtension(file_path),
        errorCount,
        warningCount
      }) : t('validation.results.tool.completed', { 
        filePath: extractFilenameWithoutExtension(file_path),
        errorCount,
        warningCount
      });

      context.setLabel(labelContent);
      
      // Format the validation report
      let report = `# ${fileType.charAt(0).toUpperCase() + fileType.slice(1)} Validation Report: ${file.basename}\n\n`;
      
      if (result.isValid) {
        report += `✅ **Status: VALID** - ${fileType.charAt(0).toUpperCase() + fileType.slice(1)} passes all validation checks\n\n`;
      } else {
        const errorCount = result.issues.filter(issue => issue.severity === 'error').length;
        report += `❌ **Status: INVALID** - ${fileType.charAt(0).toUpperCase() + fileType.slice(1)} has ${errorCount} error(s)\n\n`;
      }

      // Group issues by severity
      const errors = result.issues.filter(issue => issue.severity === 'error');
      const warnings = result.issues.filter(issue => issue.severity === 'warning');

      if (errors.length > 0) {
        report += `## ❌ Errors (${errors.length})\n`;
        errors.forEach((error, index) => {
          report += `${index + 1}. **${error.type}**: ${error.message}`;
          if (error.field) {
            report += ` (field: ${error.field})`;
          }
          report += '\n';
        });
        report += '\n';
      }

      if (warnings.length > 0) {
        report += `## ⚠️ Warnings (${warnings.length})\n`;
        warnings.forEach((warning, index) => {
          report += `${index + 1}. **${warning.type}**: ${warning.message}`;
          if (warning.field) {
            report += ` (field: ${warning.field})`;
          }
          report += '\n';
        });
        report += '\n';
      }

      if (result.issues.length === 0) {
        report += `## ✅ All Checks Passed\n`;
        report += `No issues found. This ${fileType} file is properly configured.\n\n`;
      }

      // Old format usage is now reported as validation errors, not migration opportunities

      report += `## Validation Summary\n`;
      report += `- **File Type**: ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}\n`;
      report += `- **File Path**: ${file.path}\n`;
      report += `- **File Size**: ${file.stat.size} bytes\n`;
      report += `- **Last Modified**: ${new Date(file.stat.mtime).toLocaleString()}\n`;
      report += `- **Old Format Usage**: ${migrationAnalysis.totalCount > 0 ? 'Found (see errors above)' : 'None'}\n`;
      report += `- **Errors**: ${errors.length}\n`;
      report += `- **Warnings**: ${warnings.length}\n`;
      report += `- **Overall Status**: ${result.isValid ? 'VALID' : 'INVALID'}\n`;

      if (!result.isValid) {
        report += `\n## 🔧 Next Steps\n`;
        report += `**To fix validation issues:**\n`;
        report += `1. Review the errors and warnings listed above\n`;
        report += `2. Use the note_edit tool to modify the ${fileType} file and address each issue\n`;
        report += `3. For old format links, replace them with the new format as shown in error messages\n`;
        report += `4. Run validation again to confirm all fixes are complete\n`;
        
        if (fileType === "mode") {
          report += `5. For mode format issues, consider using the Guide mode for assistance\n`;
        }
      }

      context.progress(report);
    } catch (error) {
      context.setLabel(t('tools.modeValidator.labels.failed', { fileName: extractFilenameWithoutExtension(file_path) }));
      throw error;
    }
  }
}; 