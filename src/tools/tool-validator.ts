import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { TFile } from "obsidian";
import { UserDefinedTool } from "../user-tools/types";
import { UserDefinedToolScanner } from "../user-tools/UserDefinedToolScanner";
import * as yaml from "js-yaml";

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

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

export const toolValidatorTool: ObsidianTool<ToolValidatorInput> = {
  specification: schema,
  icon: "wrench",
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
        filePath: tool_path,
        description: "Open tool file"
      });

      context.setLabel(`Tool validation completed: ${tool_path}`);
      
      // Format the validation report
      let report = `# Tool Validation Report: ${file.basename}\n\n`;
      
      if (result.isValid) {
        report += `✅ **Status: VALID** - Tool passes all validation checks\n\n`;
      } else {
        report += `❌ **Status: INVALID** - Tool has ${result.errors.length} error(s)\n\n`;
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
      context.setLabel(`Tool validation failed: ${tool_path}`);
      throw error;
    }
  }
};

async function validateToolFile(app: any, file: TFile): Promise<ValidationResult> {
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

    // Check for ln-tool tag
    const cache = app.metadataCache.getFileCache(file);
    const tags = cache?.tags?.map((tag: any) => tag.tag) || [];
    const frontmatterTags = cache?.frontmatter?.tags || [];
    
    const normalizedFrontmatterTags = Array.isArray(frontmatterTags)
      ? frontmatterTags
      : [frontmatterTags];

    const hasToolTag = tags.includes("#ln-tool") || normalizedFrontmatterTags.includes("ln-tool");
    
    if (!hasToolTag) {
      result.errors.push("File does not have the required 'ln-tool' tag in frontmatter or body");
      result.isValid = false;
    } else {
      result.info.push("File has required 'ln-tool' tag");
    }

    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!frontmatterMatch) {
      result.errors.push("File has no frontmatter. Tools require YAML frontmatter between --- markers");
      result.isValid = false;
      return result;
    }

    const [, frontmatterStr, bodyContent] = frontmatterMatch;
    
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

    // Validate required frontmatter fields
    validateRequiredFrontmatterFields(frontmatter, result);

    // Extract and validate JSON schema blocks
    const jsonBlocks = extractJSONBlocks(bodyContent);
    validateJSONSchema(jsonBlocks, result);

    // Extract and validate JavaScript code blocks
    const jsBlocks = extractJavaScriptBlocks(bodyContent);
    validateJavaScriptCode(jsBlocks, result);

    // Try to parse tool using the actual scanner
    try {
      const scanner = new UserDefinedToolScanner(app);
      const tools = await scanner.scanForTools();
      const tool = tools.find(t => t.filePath === file.path);
      
      if (tool) {
        result.info.push("Tool parsed successfully by scanner");
        // Validate parsed tool structure
        validateParsedTool(tool, result);
      } else {
        result.warnings.push("Tool was not found by scanner - may not meet all requirements for loading");
      }
      
    } catch (scannerError) {
      result.errors.push(`Tool scanner failed to parse tool: ${scannerError instanceof Error ? scannerError.message : 'Unknown scanner error'}`);
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

function validateRequiredFrontmatterFields(frontmatter: Record<string, any>, result: ValidationResult): void {
  // Check for required fields
  const requiredFields = ['ln-tool-version', 'ln-tool-description'];
  
  for (const field of requiredFields) {
    if (!frontmatter[field]) {
      result.errors.push(`Missing required frontmatter field: ${field}`);
    } else if (typeof frontmatter[field] !== 'string' || frontmatter[field].trim() === '') {
      result.errors.push(`Required frontmatter field '${field}' must be a non-empty string`);
    } else {
      result.info.push(`${field}: "${frontmatter[field]}"`);
    }
  }

  // Check version format
  if (frontmatter['ln-tool-version']) {
    const version = String(frontmatter['ln-tool-version']).trim();
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      result.warnings.push(`Tool version '${version}' doesn't follow semantic versioning (e.g., '1.0.0')`);
    } else {
      result.info.push(`Version follows semantic versioning: ${version}`);
    }
  }

  // Check optional fields
  if (frontmatter['ln-tool-icon']) {
    result.info.push(`Icon: ${frontmatter['ln-tool-icon']}`);
  } else {
    result.info.push("No custom icon specified - will use default 'wrench' icon");
  }

  if (frontmatter['ln-tool-enabled'] !== undefined) {
    const enabled = frontmatter['ln-tool-enabled'];
    if (typeof enabled === 'boolean') {
      result.info.push(`Tool enabled: ${enabled}`);
    } else {
      result.warnings.push(`ln-tool-enabled should be a boolean (true/false), got: ${typeof enabled}`);
    }
  } else {
    result.info.push("Tool enabled by default (no ln-tool-enabled specified)");
  }
}

function extractJSONBlocks(content: string): string[] {
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
  const blocks: string[] = [];
  let match;
  
  while ((match = jsonBlockRegex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  
  return blocks;
}

function extractJavaScriptBlocks(content: string): string[] {
  const jsBlockRegex = /```(?:javascript|js)\s*\n([\s\S]*?)\n```/g;
  const blocks: string[] = [];
  let match;
  
  while ((match = jsBlockRegex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  
  return blocks;
}

function validateJSONSchema(jsonBlocks: string[], result: ValidationResult): void {
  if (jsonBlocks.length === 0) {
    result.warnings.push("No JSON schema blocks found - tool will have empty schema");
    return;
  }

  if (jsonBlocks.length > 1) {
    result.warnings.push(`Multiple JSON blocks found (${jsonBlocks.length}) - only the first will be used as schema`);
  }

  const schemaBlock = jsonBlocks[0];
  
  try {
    const schema = JSON.parse(schemaBlock);
    result.info.push("JSON schema parsed successfully");
    
    // Validate schema structure
    if (typeof schema !== 'object' || schema === null) {
      result.warnings.push("Schema should be a JSON object");
    } else {
      // Check for common schema properties
      if (schema.input_schema) {
        result.info.push("Schema has input_schema property");
        
        if (schema.input_schema.type === 'object' && schema.input_schema.properties) {
          const propCount = Object.keys(schema.input_schema.properties).length;
          result.info.push(`Schema defines ${propCount} input parameter(s)`);
          
          if (schema.input_schema.required && Array.isArray(schema.input_schema.required)) {
            result.info.push(`Schema has ${schema.input_schema.required.length} required parameter(s)`);
          }
        }
      } else {
        result.warnings.push("Schema missing 'input_schema' property - tool may not accept parameters correctly");
      }

      // Check for description
      if (schema.description) {
        result.info.push(`Schema description: "${schema.description}"`);
      } else {
        result.warnings.push("Schema missing 'description' property");
      }
    }
    
  } catch (parseError) {
    result.errors.push(`Invalid JSON in schema block: ${parseError instanceof Error ? parseError.message : 'Unknown JSON parse error'}`);
  }
}

function validateJavaScriptCode(jsBlocks: string[], result: ValidationResult): void {
  if (jsBlocks.length === 0) {
    result.errors.push("No JavaScript code blocks found - tool requires executable code");
    return;
  }

  if (jsBlocks.length > 1) {
    result.warnings.push(`Multiple JavaScript blocks found (${jsBlocks.length}) - only the first will be used`);
  }

  const codeBlock = jsBlocks[0];
  
  if (codeBlock.trim().length === 0) {
    result.errors.push("JavaScript code block is empty");
    return;
  }

  result.info.push(`JavaScript code length: ${codeBlock.length} characters`);

  // Basic syntax validation (simplified)
  try {
    // Try to construct a function with the code to check for basic syntax errors
    new Function('context', codeBlock);
    result.info.push("JavaScript code passed basic syntax check");
  } catch (syntaxError) {
    result.errors.push(`JavaScript syntax error: ${syntaxError instanceof Error ? syntaxError.message : 'Unknown syntax error'}`);
  }

  // Check for common patterns and issues
  validateCodePatterns(codeBlock, result);
}

function validateCodePatterns(code: string, result: ValidationResult): void {
  // Check for async patterns
  if (code.includes('await ') && !code.includes('async ')) {
    result.warnings.push("Code uses 'await' but function may not be declared as async");
  }

  // Check for context usage
  if (code.includes('context.')) {
    result.info.push("Code properly uses the context parameter");
  } else {
    result.warnings.push("Code doesn't appear to use the context parameter - it may not interact with the tool system properly");
  }

  // Check for common context methods
  const contextMethods = ['progress', 'setLabel', 'addNavigationTarget'];
  const usedMethods = contextMethods.filter(method => code.includes(`context.${method}`));
  
  if (usedMethods.length > 0) {
    result.info.push(`Code uses context methods: ${usedMethods.join(', ')}`);
  }

  // Check for plugin access
  if (code.includes('context.plugin')) {
    result.info.push("Code accesses plugin instance for Obsidian API");
  }

  // Check for parameter access
  if (code.includes('context.params')) {
    result.info.push("Code accesses input parameters");
  }

  // Check for error handling
  if (code.includes('try') && code.includes('catch')) {
    result.info.push("Code includes error handling");
  } else {
    result.warnings.push("Code lacks error handling - consider adding try/catch blocks");
  }

  // Check for return statements
  if (!code.includes('return')) {
    result.warnings.push("Code doesn't appear to return a value - consider if this is intentional");
  }
}

function validateParsedTool(tool: UserDefinedTool, result: ValidationResult): void {
  // Validate tool structure
  if (!tool.name || tool.name.trim().length === 0) {
    result.errors.push("Parsed tool has empty name");
  } else {
    result.info.push(`Tool name: ${tool.name}`);
  }

  if (!tool.description || tool.description.trim().length === 0) {
    result.warnings.push("Tool has empty description");
  } else {
    result.info.push(`Tool description: "${tool.description}"`);
  }

  if (!tool.version || tool.version.trim().length === 0) {
    result.errors.push("Tool has empty version");
  } else {
    result.info.push(`Tool version: ${tool.version}`);
  }

  // Validate hashes
  if (tool.codeHash && tool.codeHash.length === 64) {
    result.info.push("Code hash generated successfully");
  } else {
    result.warnings.push("Code hash appears invalid");
  }

  if (tool.schemaHash && tool.schemaHash.length === 64) {
    result.info.push("Schema hash generated successfully");
  } else {
    result.warnings.push("Schema hash appears invalid");
  }

  // Check approval status
  if (tool.approved) {
    result.info.push("Tool is approved for execution");
  } else {
    result.info.push("Tool requires user approval before execution");
  }

  // Check enabled status
  if (tool.enabled) {
    result.info.push("Tool is enabled");
  } else {
    result.warnings.push("Tool is disabled");
  }

  // Validate file path
  if (tool.filePath) {
    result.info.push(`Tool file path: ${tool.filePath}`);
  } else {
    result.warnings.push("Tool missing file path");
  }
} 