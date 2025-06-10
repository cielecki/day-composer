import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { TFile } from "obsidian";
import { validateModeFile, ModeValidationResult } from '../utils/validation/mode-validation';
import { validateToolFile, ToolValidationResult } from '../utils/validation/tool-validation';

const schema = {
  name: "mode_validator",
  description: "Validates Life Navigator mode and tool files for completeness, correctness, and functionality. Checks frontmatter structure, required attributes, and identifies common issues.",
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
  get initialLabel() {
    return t('tools.modeValidator.label');
  },
  execute: async (context: ToolExecutionContext<ModeValidatorInput>): Promise<void> => {
    const { plugin, params } = context;
    const { file_path, type = "auto" } = params;

    context.setLabel(t('tools.modeValidator.inProgress', { filePath: file_path }));

    try {
      const file = plugin.app.vault.getAbstractFileByPath(file_path);
      
      if (!file) {
        context.setLabel(t('tools.modeValidator.failed', { filePath: file_path }));
        throw new ToolExecutionError(`File not found: ${file_path}`);
      }
      
      if (!(file instanceof TFile)) {
        context.setLabel(t('tools.modeValidator.failed', { filePath: file_path }));
        throw new ToolExecutionError(`Path is not a file: ${file_path}`);
      }

      if (file.extension !== 'md') {
        context.setLabel(t('tools.modeValidator.failed', { filePath: file_path }));
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
        
        if (normalizedTags.includes("ln-mode") || metadata?.frontmatter?.ln_mode) {
          fileType = "mode";
        } else if (normalizedTags.includes("ln-tool")) {
          fileType = "tool";
        } else {
          context.setLabel(t('tools.modeValidator.failed', { filePath: file_path }));
          throw new ToolExecutionError(`Could not determine file type. File must have 'ln-mode' or 'ln-tool' tag.`);
        }
      }
      
      // Validate based on type
      let result: ModeValidationResult | ToolValidationResult;
      if (fileType === "mode") {
        result = validateModeFile(file, metadata, content);
      } else {
        result = validateToolFile(file, metadata, content);
      }
      
      // Add navigation target
      context.addNavigationTarget({
        filePath: file_path,
        description: `Open ${fileType} file`
      });

      // Set completion label with issue counts
      const errorCount = result.issues.filter(issue => issue.severity === 'error').length;
      const warningCount = result.issues.filter(issue => issue.severity === 'warning').length;
      
      const labelContent = fileType === "mode" ? t('validation.results.mode.completed', { 
        filePath: file_path,
        errorCount,
        warningCount
      }) : t('validation.results.tool.completed', { 
        filePath: file_path,
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

      report += `## Validation Summary\n`;
      report += `- **File Type**: ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}\n`;
      report += `- **File Path**: ${file.path}\n`;
      report += `- **File Size**: ${file.stat.size} bytes\n`;
      report += `- **Last Modified**: ${new Date(file.stat.mtime).toLocaleString()}\n`;
      report += `- **Errors**: ${errors.length}\n`;
      report += `- **Warnings**: ${warnings.length}\n`;
      report += `- **Overall Status**: ${result.isValid ? 'VALID' : 'INVALID'}\n`;

      if (!result.isValid) {
        report += `\n## 🔧 Next Steps\n`;
        report += `To fix the validation issues:\n`;
        report += `1. Review the errors and warnings listed above\n`;
        report += `2. Edit the ${fileType} file to address each issue\n`;
        report += `3. Run validation again to confirm fixes\n`;
        
        if (fileType === "mode") {
          report += `4. For mode format issues, consider using the Guide mode for assistance\n`;
        }
      }

      context.progress(report);
    } catch (error) {
      context.setLabel(t('tools.modeValidator.failed', { filePath: file_path }));
      throw error;
    }
  }
}; 