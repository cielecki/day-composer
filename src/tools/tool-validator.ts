import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { TFile } from "obsidian";
import { validateToolFile } from '../utils/validation/tool-validation';
import { t } from 'src/i18n';
import { extractFilenameWithoutExtension } from '../utils/text/string-sanitizer';

const schema = {
  name: "tool_validator",
  description: "Validates a user-defined Life Navigator tool file for completeness, correctness, and functionality. Checks frontmatter structure, schema validity, code syntax, and tool system integration.",
  input_schema: {
    type: "object",
    properties: {
      tool_path: {
        type: "string",
        description: "The path to the tool file to validate (including .md extension)",
      }
    },
    required: ["tool_path"]
  }
};

type ToolValidatorInput = {
  tool_path: string;
}



export const toolValidatorTool: ObsidianTool<ToolValidatorInput> = {
  specification: schema,
  icon: "wrench",
  sideEffects: false, // Read-only validation, safe for link expansion
  initialLabel: "Validate Tool",
  execute: async (context: ToolExecutionContext<ToolValidatorInput>): Promise<void> => {
    const { plugin, params } = context;
    const { tool_path } = params;

    context.setLabel(`Validating tool: ${tool_path}`);

    try {
      const file = plugin.app.vault.getAbstractFileByPath(tool_path);
      
      if (!file) {
        context.setLabel(`Tool validation failed: ${tool_path}`);
        throw new ToolExecutionError(`File not found: ${tool_path}`);
      }
      
      if (!(file instanceof TFile)) {
        context.setLabel(`Tool validation failed: ${tool_path}`);
        throw new ToolExecutionError(`Path is not a file: ${tool_path}`);
      }

      if (file.extension !== 'md') {
        context.setLabel(`Tool validation failed: ${tool_path}`);
        throw new ToolExecutionError(`Tool files must be markdown files (.md extension): ${tool_path}`);
      }

      const result = await validateToolFile(plugin.app, file);
      
      // Add navigation target
      context.addNavigationTarget({
        filePath: tool_path
      });

      // Group issues by severity for backward compatibility
      const errors = result.issues.filter(issue => issue.severity === 'error');
      const warnings = result.issues.filter(issue => issue.severity === 'warning');
      const info = result.issues.filter(issue => issue.severity === 'info');

      // Set completion label with issue counts
      context.setLabel(t('validation.results.tool.completed', { 
        filePath: extractFilenameWithoutExtension(tool_path),
        errorCount: errors.length,
        warningCount: warnings.length
      }));
      
      // Format the validation report
      let report = `# Tool Validation Report: ${file.basename}\n\n`;
      
      if (result.isValid) {
        report += `✅ **Status: VALID** - Tool passes all validation checks\n\n`;
      } else {
        report += `❌ **Status: INVALID** - Tool has ${errors.length} error(s)\n\n`;
      }

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

      if (info.length > 0) {
        report += `## ℹ️ Information (${info.length})\n`;
        info.forEach((infoItem, index) => {
          report += `${index + 1}. **${infoItem.type}**: ${infoItem.message}`;
          if (infoItem.field) {
            report += ` (field: ${infoItem.field})`;
          }
          report += '\n';
        });
        report += '\n';
      }

      report += `## Validation Summary\n`;
      report += `- **File Path**: ${file.path}\n`;
      report += `- **File Size**: ${file.stat.size} bytes\n`;
      report += `- **Last Modified**: ${new Date(file.stat.mtime).toLocaleString()}\n`;
      report += `- **Errors**: ${errors.length}\n`;
      report += `- **Warnings**: ${warnings.length}\n`;
      report += `- **Info Items**: ${info.length}\n`;

      context.progress(report);
    } catch (error) {
      context.setLabel(`Tool validation failed: ${tool_path}`);
      throw error;
    }
  }
};




 