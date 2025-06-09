import { TFile, CachedMetadata, FrontMatterCache } from "obsidian";

export interface ToolValidationResult {
	isValid: boolean;
	issues: ToolValidationIssue[];
}

export interface ToolValidationIssue {
	type: 'missing_required_field' | 'invalid_field_value' | 'invalid_code' | 'invalid_structure' | 'security_issue';
	field?: string;
	message: string;
	severity: 'error' | 'warning';
}

/**
 * Validates a tool file and returns all detected issues
 */
export function validateToolFile(
	file: TFile,
	metadata: CachedMetadata | null,
	content?: string
): ToolValidationResult {
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
	
	// Check for required fields
	if (!frontmatter.name || !frontmatter.name.trim()) {
		issues.push({
			type: 'missing_required_field',
			field: 'name',
			message: 'Tool name is required',
			severity: 'error'
		});
	}
	
	if (!frontmatter.description || !frontmatter.description.trim()) {
		issues.push({
			type: 'missing_required_field',
			field: 'description',
			message: 'Tool description is required',
			severity: 'error'
		});
	}
	
	// Validate field types
	if (frontmatter.name !== undefined && typeof frontmatter.name !== 'string') {
		issues.push({
			type: 'invalid_field_value',
			field: 'name',
			message: 'name must be a string',
			severity: 'error'
		});
	}
	
	if (frontmatter.description !== undefined && typeof frontmatter.description !== 'string') {
		issues.push({
			type: 'invalid_field_value',
			field: 'description',
			message: 'description must be a string',
			severity: 'error'
		});
	}
	
	if (frontmatter.version !== undefined && typeof frontmatter.version !== 'string') {
		issues.push({
			type: 'invalid_field_value',
			field: 'version',
			message: 'version must be a string',
			severity: 'error'
		});
	}
	
	// Validate tool name format
	if (frontmatter.name) {
		const toolName = String(frontmatter.name);
		if (!/^[a-z][a-z0-9_]*$/.test(toolName)) {
			issues.push({
				type: 'invalid_field_value',
				field: 'name',
				message: 'Tool name must start with lowercase letter and contain only lowercase letters, numbers, and underscores',
				severity: 'error'
			});
		}
	}
	
	// Check content structure
	if (content !== undefined) {
		const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;
		const codeContent = content.replace(frontmatterRegex, '').trim();
		
		if (!codeContent) {
			issues.push({
				type: 'invalid_structure',
				message: 'Tool file has no JavaScript code after frontmatter',
				severity: 'error'
			});
		} else {
			// Basic JavaScript syntax validation
			try {
				// Check if it looks like a function
				if (!codeContent.includes('function') && !codeContent.includes('=>') && !codeContent.includes('async')) {
					issues.push({
						type: 'invalid_code',
						message: 'Tool code does not appear to contain a function',
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
					if (pattern.test(codeContent)) {
						issues.push({
							type: 'security_issue',
							message,
							severity: 'warning'
						});
					}
				}
				
			} catch (error) {
				issues.push({
					type: 'invalid_code',
					message: 'Code appears to have syntax issues',
					severity: 'warning'
				});
			}
		}
	}
	
	// Check for schema if provided
	if (frontmatter.schema) {
		try {
			if (typeof frontmatter.schema === 'string') {
				JSON.parse(frontmatter.schema);
			}
		} catch (error) {
			issues.push({
				type: 'invalid_field_value',
				field: 'schema',
				message: 'Schema is not valid JSON',
				severity: 'error'
			});
		}
	}
	
	const hasErrors = issues.some(issue => issue.severity === 'error');
	
	return {
		isValid: !hasErrors,
		issues
	};
} 