import { TFile, CachedMetadata, FrontMatterCache } from "obsidian";
import { validateIconField } from "./lucide-icon-validation";
import { UserDefinedTool } from "../../types/user-tools";
import { UserDefinedToolScanner } from "../../services/UserDefinedToolScanner";

export interface ToolValidationResult {
	isValid: boolean;
	issues: ToolValidationIssue[];
}

export interface ToolValidationIssue {
	type: 'old_format' | 'missing_required_field' | 'invalid_field_value' | 'invalid_code' | 'invalid_structure' | 'security_issue' | 'compatibility_warning' | 'info';
	field?: string;
	message: string;
	severity: 'error' | 'warning' | 'info';
}

/**
 * Validates a tool file and returns all detected issues
 * Enhanced version that includes comprehensive validation from tool-validator.ts
 */
export async function validateToolFile(
	app: any,
	file: TFile,
	metadata?: CachedMetadata | null,
	content?: string
): Promise<ToolValidationResult> {
	const issues: ToolValidationIssue[] = [];
	
	// Get metadata if not provided
	if (metadata === undefined) {
		metadata = app.metadataCache.getFileCache(file);
	}
	
	// Get content if not provided
	if (content === undefined) {
		try {
			content = await app.vault.read(file);
		} catch (error) {
			issues.push({
				type: 'invalid_structure',
				message: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
				severity: 'error'
			});
			return { isValid: false, issues };
		}
	}
	
	// Check if file is empty
	if (!content || content.trim().length === 0) {
		issues.push({
			type: 'invalid_structure',
			message: 'File is empty',
			severity: 'error'
		});
		return { isValid: false, issues };
	}
	
	// Check for ln-tool tag
	const frontmatterTags = metadata?.frontmatter?.tags || [];
	const normalizedFrontmatterTags = Array.isArray(frontmatterTags)
		? frontmatterTags
		: [frontmatterTags];

	const hasToolTag = normalizedFrontmatterTags.includes("ln-tool");
	
	if (!hasToolTag) {
		issues.push({
			type: 'missing_required_field',
			field: 'tags',
			message: 'Missing required ln-tool tag in frontmatter',
			severity: 'error'
		});
		return { isValid: false, issues };
	} else {
		issues.push({
			type: 'info',
			message: 'File has required ln-tool tag',
			severity: 'info'
		});
	}
	
	// Parse frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	
	if (!frontmatterMatch) {
		issues.push({
			type: 'invalid_structure',
			message: 'File has no frontmatter. Tools require YAML frontmatter between --- markers',
			severity: 'error'
		});
		return { isValid: false, issues };
	}

	const [, frontmatterStr, bodyContent] = frontmatterMatch;
	const frontmatter = metadata?.frontmatter || {};
	
	// Validate frontmatter fields
	validateRequiredFrontmatterFields(frontmatter, issues);
	
	// Extract and validate JSON schema blocks
	const jsonBlocks = extractJSONBlocks(bodyContent);
	validateJSONSchema(jsonBlocks, issues);

	// Extract and validate JavaScript code blocks
	const jsBlocks = extractJavaScriptBlocks(bodyContent);
	validateJavaScriptCode(jsBlocks, issues);

	// Note: Tool files contain JavaScript code, not markdown content subject to link expansion.
	// Therefore, we don't need to validate for Life Navigator link formats here.

	// Try to parse tool using the actual scanner
	try {
		const scanner = new UserDefinedToolScanner(app);
		const tools = await scanner.scanForTools();
		const tool = tools.find(t => t.filePath === file.path);
		
		if (tool) {
			issues.push({
				type: 'info',
				message: 'Tool parsed successfully by scanner',
				severity: 'info'
			});
			// Validate parsed tool structure
			validateParsedTool(tool, issues);
		} else {
			issues.push({
				type: 'compatibility_warning',
				message: 'Tool was not found by scanner - may not meet all requirements for loading',
				severity: 'warning'
			});
		}
	} catch (scannerError) {
		issues.push({
			type: 'invalid_structure',
			message: `Tool scanner failed to parse tool: ${scannerError instanceof Error ? scannerError.message : 'Unknown scanner error'}`,
			severity: 'error'
		});
	}
	
	const hasErrors = issues.some(issue => issue.severity === 'error');
	
	return {
		isValid: !hasErrors,
		issues
	};
}

function validateRequiredFrontmatterFields(frontmatter: Record<string, any>, issues: ToolValidationIssue[]): void {
	// Only support new format fields
	const requiredFields = ['version', 'description'];
	const oldFormatFields = ['ln_version', 'ln_description', 'ln_name', 'ln_icon', 'ln_enabled'];
	
	// Check for old format usage and generate errors
	for (const oldField of oldFormatFields) {
		if (frontmatter[oldField] !== undefined) {
			const newField = oldField.replace('ln_', '');
			issues.push({
				type: 'invalid_field_value',
				field: oldField,
				message: `Old format field '${oldField}' is no longer supported. Please use '${newField}' instead.`,
				severity: 'error'
			});
		}
	}

	// Check for version format inconsistencies
	const version = frontmatter.version;
	if (version && typeof version === 'string') {
		const versionStr = version.trim();
		if (versionStr.startsWith('v') && /^v\d+\.\d+\.\d+/.test(versionStr)) {
			issues.push({
				type: 'invalid_field_value',
				field: 'version',
				message: `Version format '${versionStr}' should not include 'v' prefix. Use '${versionStr.substring(1)}' instead.`,
				severity: 'error'
			});
		}
	}

	// Check for boolean format issues
	const booleanFields = ['enabled'];
	for (const field of booleanFields) {
		if (frontmatter[field] !== undefined) {
			const value = String(frontmatter[field]).toLowerCase();
			if (value === 'yes' || value === 'no') {
				issues.push({
					type: 'invalid_field_value',
					field: field,
					message: `Boolean field '${field}' uses old format '${value}'. Use 'true' or 'false' instead.`,
					severity: 'error'
				});
			}
		}
	}

	// Check for mixed format usage (using both old and new)
	const hasOldFormat = oldFormatFields.some(field => frontmatter[field] !== undefined);
	const hasNewFormat = requiredFields.some(field => frontmatter[field] !== undefined);
	if (hasOldFormat && hasNewFormat) {
		issues.push({
			type: 'invalid_field_value',
			message: 'Mixed format usage detected. Remove all old format fields (ln_*) and use only new format fields.',
			severity: 'error'
		});
	}
	
	// Check for required fields (new format only)
	for (const field of requiredFields) {
		if (!frontmatter[field]) {
			issues.push({
				type: 'missing_required_field',
				field,
				message: `Missing required frontmatter field: ${field}`,
				severity: 'error'
			});
		} else if (typeof frontmatter[field] !== 'string' || frontmatter[field].trim() === '') {
			issues.push({
				type: 'invalid_field_value',
				field,
				message: `Required frontmatter field '${field}' must be a non-empty string`,
				severity: 'error'
			});
		} else {
			issues.push({
				type: 'info',
				message: `${field}: "${frontmatter[field]}"`,
				severity: 'info'
			});
		}
	}

	// Check version format (new format only)
	if (version) {
		const versionStr = String(version).trim();
		if (!/^\d+\.\d+\.\d+/.test(versionStr)) {
			issues.push({
				type: 'invalid_field_value',
				field: 'version',
				message: `Tool version '${versionStr}' doesn't follow semantic versioning (e.g., '1.0.0')`,
				severity: 'warning'
			});
		} else {
			issues.push({
				type: 'info',
				message: `Version follows semantic versioning: ${versionStr}`,
				severity: 'info'
			});
		}
	}

	// Validate name field (new format only)
	const name = frontmatter.name;
	if (name) {
		if (typeof name !== 'string') {
			issues.push({
				type: 'invalid_field_value',
				field: 'name',
				message: 'name must be a string',
				severity: 'error'
			});
		} else {
			const toolName = String(name);
			if (!/^[a-z][a-z0-9_]*$/.test(toolName)) {
				issues.push({
					type: 'invalid_field_value',
					field: 'name',
					message: 'Tool name must start with lowercase letter and contain only lowercase letters, numbers, and underscores',
					severity: 'error'
				});
			}
		}
	}

	// Check optional fields (new format only)
	const icon = frontmatter.icon;
	if (icon) {
		// Validate the icon using Lucide icon validation
		const iconValidation = validateIconField(icon, 'icon', false);
		if (iconValidation.isValid) {
			issues.push({
				type: 'info',
				message: `Icon: ${icon} (valid Lucide icon)`,
				severity: 'info'
			});
		} else if (iconValidation.issue) {
			issues.push(iconValidation.issue);
		}
	} else {
		issues.push({
			type: 'info',
			message: "No custom icon specified - will use default 'wrench' icon",
			severity: 'info'
		});
	}

	const enabled = frontmatter.enabled;
	if (enabled !== undefined) {
		if (typeof enabled === 'boolean') {
			issues.push({
				type: 'info',
				message: `Tool enabled: ${enabled}`,
				severity: 'info'
			});
		} else {
			issues.push({
				type: 'invalid_field_value',
				field: 'enabled',
				message: `enabled should be a boolean (true/false), got: ${typeof enabled}`,
				severity: 'warning'
			});
		}
	} else {
		issues.push({
			type: 'info',
			message: 'Tool enabled by default (no enabled specified)',
			severity: 'info'
		});
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

function validateJSONSchema(jsonBlocks: string[], issues: ToolValidationIssue[]): void {
	if (jsonBlocks.length === 0) {
		issues.push({
			type: 'compatibility_warning',
			message: 'No JSON schema blocks found - tool will have empty schema',
			severity: 'warning'
		});
		return;
	}

	if (jsonBlocks.length > 1) {
		issues.push({
			type: 'compatibility_warning',
			message: `Multiple JSON blocks found (${jsonBlocks.length}) - only the first will be used as schema`,
			severity: 'warning'
		});
	}

	const schemaBlock = jsonBlocks[0];
	
	try {
		const schema = JSON.parse(schemaBlock);
		issues.push({
			type: 'info',
			message: 'JSON schema parsed successfully',
			severity: 'info'
		});
		
		// Validate schema structure
		if (typeof schema !== 'object' || schema === null) {
			issues.push({
				type: 'invalid_field_value',
				field: 'schema',
				message: 'Schema should be a JSON object',
				severity: 'warning'
			});
		} else {
			// Check for common schema properties
			if (schema.input_schema) {
				issues.push({
					type: 'info',
					message: 'Schema has input_schema property',
					severity: 'info'
				});
				
				if (schema.input_schema.type === 'object' && schema.input_schema.properties) {
					const propCount = Object.keys(schema.input_schema.properties).length;
					issues.push({
						type: 'info',
						message: `Schema defines ${propCount} input parameter(s)`,
						severity: 'info'
					});
					
					if (schema.input_schema.required && Array.isArray(schema.input_schema.required)) {
						issues.push({
							type: 'info',
							message: `Schema has ${schema.input_schema.required.length} required parameter(s)`,
							severity: 'info'
						});
					}
				}
			} else {
				issues.push({
					type: 'invalid_field_value',
					field: 'schema',
					message: "Schema missing 'input_schema' property - tool may not accept parameters correctly",
					severity: 'warning'
				});
			}

			// Check for description
			if (schema.description) {
				issues.push({
					type: 'info',
					message: `Schema description: "${schema.description}"`,
					severity: 'info'
				});
			} else {
				issues.push({
					type: 'invalid_field_value',
					field: 'schema',
					message: "Schema missing 'description' property",
					severity: 'warning'
				});
			}
		}
		
	} catch (parseError) {
		issues.push({
			type: 'invalid_field_value',
			field: 'schema',
			message: `Invalid JSON in schema block: ${parseError instanceof Error ? parseError.message : 'Unknown JSON parse error'}`,
			severity: 'error'
		});
	}
}

function validateJavaScriptCode(jsBlocks: string[], issues: ToolValidationIssue[]): void {
	if (jsBlocks.length === 0) {
		issues.push({
			type: 'invalid_structure',
			message: 'No JavaScript code blocks found - tool requires executable code',
			severity: 'error'
		});
		return;
	}

	if (jsBlocks.length > 1) {
		issues.push({
			type: 'compatibility_warning',
			message: `Multiple JavaScript blocks found (${jsBlocks.length}) - only the first will be used`,
			severity: 'warning'
		});
	}

	const codeBlock = jsBlocks[0];
	
	if (codeBlock.trim().length === 0) {
		issues.push({
			type: 'invalid_code',
			message: 'JavaScript code block is empty',
			severity: 'error'
		});
		return;
	}

	issues.push({
		type: 'info',
		message: `JavaScript code length: ${codeBlock.length} characters`,
		severity: 'info'
	});

	// Basic syntax validation (simplified)
	try {
		// Try to construct a function with the code to check for basic syntax errors
		new Function('context', codeBlock);
		issues.push({
			type: 'info',
			message: 'JavaScript code passed basic syntax check',
			severity: 'info'
		});
	} catch (syntaxError) {
		issues.push({
			type: 'invalid_code',
			message: `JavaScript syntax error: ${syntaxError instanceof Error ? syntaxError.message : 'Unknown syntax error'}`,
			severity: 'error'
		});
	}

	// Check for common patterns and issues
	validateCodePatterns(codeBlock, issues);
}

function validateCodePatterns(code: string, issues: ToolValidationIssue[]): void {
	// Check for async patterns
	if (code.includes('await ') && !code.includes('async ')) {
		issues.push({
			type: 'invalid_code',
			message: "Code uses 'await' but function may not be declared as async",
			severity: 'warning'
		});
	}

	// Check for context usage
	if (code.includes('context.')) {
		issues.push({
			type: 'info',
			message: 'Code properly uses the context parameter',
			severity: 'info'
		});
	} else {
		issues.push({
			type: 'compatibility_warning',
			message: "Code doesn't appear to use the context parameter - it may not interact with the tool system properly",
			severity: 'warning'
		});
	}

	// Check for common context methods
	const contextMethods = ['progress', 'setLabel', 'addNavigationTarget'];
	const usedMethods = contextMethods.filter(method => code.includes(`context.${method}`));
	
	if (usedMethods.length > 0) {
		issues.push({
			type: 'info',
			message: `Code uses context methods: ${usedMethods.join(', ')}`,
			severity: 'info'
		});
	}

	// Check for plugin access
	if (code.includes('context.plugin')) {
		issues.push({
			type: 'info',
			message: 'Code accesses plugin instance for Obsidian API',
			severity: 'info'
		});
	}

	// Check for parameter access
	if (code.includes('context.params')) {
		issues.push({
			type: 'info',
			message: 'Code accesses input parameters',
			severity: 'info'
		});
	}

	// Check for error handling
	if (code.includes('try') && code.includes('catch')) {
		issues.push({
			type: 'info',
			message: 'Code includes error handling',
			severity: 'info'
		});
	} else {
		issues.push({
			type: 'compatibility_warning',
			message: 'Code lacks error handling - consider adding try/catch blocks',
			severity: 'warning'
		});
	}

	// Check for return statements
	if (!code.includes('return')) {
		issues.push({
			type: 'compatibility_warning',
			message: "Code doesn't appear to return a value - consider if this is intentional",
			severity: 'warning'
		});
	}

	// Check for common dangerous patterns
	const dangerousPatterns = [
		{ pattern: /eval\s*\(/, message: 'Use of eval() is discouraged for security reasons' },
		{ pattern: /Function\s*\(/, message: 'Use of Function() constructor is discouraged for security reasons' },
		{ pattern: /document\.write/, message: 'Use of document.write is discouraged' },
		{ pattern: /innerHTML\s*=/, message: 'Direct innerHTML assignment can be unsafe - consider safer alternatives' }
	];
	
	for (const { pattern, message } of dangerousPatterns) {
		if (pattern.test(code)) {
			issues.push({
				type: 'security_issue',
				message,
				severity: 'warning'
			});
		}
	}
}

function validateParsedTool(tool: UserDefinedTool, issues: ToolValidationIssue[]): void {
	// Validate tool structure
	if (!tool.name || tool.name.trim().length === 0) {
		issues.push({
			type: 'invalid_structure',
			message: 'Parsed tool has empty name',
			severity: 'error'
		});
	} else {
		issues.push({
			type: 'info',
			message: `Tool name: ${tool.name}`,
			severity: 'info'
		});
	}

	if (!tool.description || tool.description.trim().length === 0) {
		issues.push({
			type: 'compatibility_warning',
			message: 'Tool has empty description',
			severity: 'warning'
		});
	} else {
		issues.push({
			type: 'info',
			message: `Tool description: "${tool.description}"`,
			severity: 'info'
		});
	}

	if (!tool.version || tool.version.trim().length === 0) {
		issues.push({
			type: 'invalid_structure',
			message: 'Tool has empty version',
			severity: 'error'
		});
	} else {
		issues.push({
			type: 'info',
			message: `Tool version: ${tool.version}`,
			severity: 'info'
		});
	}

	// Validate hashes
	if (tool.codeHash && tool.codeHash.length === 64) {
		issues.push({
			type: 'info',
			message: 'Code hash generated successfully',
			severity: 'info'
		});
	} else {
		issues.push({
			type: 'compatibility_warning',
			message: 'Code hash appears invalid',
			severity: 'warning'
		});
	}

	if (tool.schemaHash && tool.schemaHash.length === 64) {
		issues.push({
			type: 'info',
			message: 'Schema hash generated successfully',
			severity: 'info'
		});
	} else {
		issues.push({
			type: 'compatibility_warning',
			message: 'Schema hash appears invalid',
			severity: 'warning'
		});
	}

	// Check approval status
	if (tool.approved) {
		issues.push({
			type: 'info',
			message: 'Tool is approved for execution',
			severity: 'info'
		});
	} else {
		issues.push({
			type: 'info',
			message: 'Tool requires user approval before execution',
			severity: 'info'
		});
	}

	// Check enabled status
	if (tool.enabled) {
		issues.push({
			type: 'info',
			message: 'Tool is enabled',
			severity: 'info'
		});
	} else {
		issues.push({
			type: 'compatibility_warning',
			message: 'Tool is disabled',
			severity: 'warning'
		});
	}

	// Validate file path
	if (tool.filePath) {
		issues.push({
			type: 'info',
			message: `Tool file path: ${tool.filePath}`,
			severity: 'info'
		});
	} else {
		issues.push({
			type: 'compatibility_warning',
			message: 'Tool missing file path',
			severity: 'warning'
		});
	}
}

// Legacy sync version for backward compatibility
export function validateToolFileSync(
	file: TFile,
	metadata: CachedMetadata | null,
	content?: string
): ToolValidationResult {
	console.warn('Using deprecated sync validateToolFileSync. Use async validateToolFile instead.');
	// For legacy sync calls, we'll return basic validation only
	const issues: ToolValidationIssue[] = [];
	
	// Check if this has the required ln-tool tag
	if (!metadata?.frontmatter?.tags?.includes('ln-tool')) {
		return { 
			isValid: false, 
			issues: [{
				type: 'missing_required_field',
				field: 'tags',
				message: 'Missing required ln-tool tag in frontmatter',
				severity: 'error'
			}] 
		};
	}
	
	const frontmatter = metadata?.frontmatter || {};
	
	// Check for old format fields and generate errors
	const oldFormatFields = ['ln_version', 'ln_description', 'ln_name', 'ln_icon', 'ln_enabled'];
	for (const oldField of oldFormatFields) {
		if (frontmatter[oldField] !== undefined) {
			const newField = oldField.replace('ln_', '');
			issues.push({
				type: 'invalid_field_value',
				field: oldField,
				message: `Old format field '${oldField}' is no longer supported. Please use '${newField}' instead.`,
				severity: 'error'
			});
		}
	}
	

	
	// Basic required field checks (new format only)
	if (!frontmatter.name) {
		issues.push({
			type: 'missing_required_field',
			field: 'name',
			message: 'Tool name is required',
			severity: 'error'
		});
	}
	
	if (!frontmatter.description) {
		issues.push({
			type: 'missing_required_field',
			field: 'description',
			message: 'Tool description is required',
			severity: 'error'
		});
	}
	
	if (!frontmatter.version) {
		issues.push({
			type: 'missing_required_field',
			field: 'version',
			message: 'Tool version is required',
			severity: 'error'
		});
	}
	
	const hasErrors = issues.some(issue => issue.severity === 'error');
	
	return {
		isValid: !hasErrors,
		issues
	};
} 