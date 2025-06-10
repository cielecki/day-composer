/**
 * Tool call parser supporting the backtick-wrapped compass format:
 * - New format: `🧭 tool_name(params)`
 * - Expand format: `🧭 expand` [[link]] (link outside backticks)
 * - Multiple parameter styles: positional, named, mixed, JavaScript object
 */

export interface ToolCallParseResult {
	toolName: string;
	parameters: Record<string, unknown>;
	isExpand?: boolean;
	expandTarget?: string;
}

/**
 * Parse a tool call string into tool name and parameters
 * @param input The tool call string (e.g., '`🧭 tool_name(params)`' or just the content inside backticks)
 * @param toolSchema Optional tool schema for mapping positional parameters
 * @returns Parsed tool name and parameters
 */
export function parseToolCall(input: string, toolSchema?: any): ToolCallParseResult {
	const trimmedInput = input.trim();
	
	// Remove backticks if present (for direct parsing of backtick content)
	const cleanInput = trimmedInput.replace(/^`|`$/g, '');
	
	// Check for expand format: 🧭 expand (note: target comes from outside the backticks)
	const expandMatch = cleanInput.match(/^🧭\s+expand$/);
	if (expandMatch) {
		return {
			toolName: 'expand',
			parameters: {},
			isExpand: true
		};
	}
	
	// Check for new format: 🧭 tool_name(params)
	const newFormatMatch = cleanInput.match(/^🧭\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
	if (newFormatMatch) {
		const [, toolName, paramString] = newFormatMatch;
		const parameters = parseParameters(paramString, toolSchema);
		return { toolName: toolName, parameters: parameters };
	}
	
	// No valid format found
	throw new Error('Invalid tool call syntax. Expected format: `🧭 tool_name(params)` or `🧭 expand` [[link]]. Note: backticks are required.');
}

/**
 * Parse parameter string into parameters object
 */
function parseParameters(paramString: string, toolSchema?: any): Record<string, unknown> {
	
	// 1. Zero parameters
	if (!paramString.trim()) {
		return {};
	}
	
	// 2. JavaScript object syntax - single object parameter
	if (isJavaScriptObject(paramString.trim())) {
		try {
			const parameters = JSON.parse(paramString);
			return parameters;
		} catch (error) {
			throw new Error(`Invalid JavaScript object: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
	
	// 3. Mixed/Named/Positional parameters
	const { positional, named } = parseParameterList(paramString);
	const parameters = mergeParameters(positional, named, toolSchema);
	
	return parameters;
}

/**
 * Check if the parameter string represents a single JavaScript object
 */
function isJavaScriptObject(paramString: string): boolean {
	const trimmed = paramString.trim();
	
	// Check if it's a single JavaScript object
	if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
		// Make sure it's not multiple parameters where one happens to be an object
		// We'll do a simple check - if there are commas at the top level outside the object,
		// then it's not a single object
		
		let depth = 0;
		let inString = false;
		let stringChar = '';
		
		for (let i = 0; i < trimmed.length; i++) {
			const char = trimmed[i];
			const prevChar = i > 0 ? trimmed[i - 1] : '';
			
			if (!inString && (char === '"' || char === "'")) {
				inString = true;
				stringChar = char;
			} else if (inString && char === stringChar && prevChar !== '\\') {
				inString = false;
			} else if (!inString) {
				if (char === '{' || char === '[') {
					depth++;
				} else if (char === '}' || char === ']') {
					depth--;
				} else if (char === ',' && depth === 1) {
					// Found a comma at top level inside the object - this is normal
					continue;
				} else if (char === ',' && depth === 0) {
					// Found a comma outside the object - this means multiple parameters
					return false;
				}
			}
		}
		
		return true;
	}
	
	return false;
}

/**
 * Parse a parameter list into positional and named parameters
 */
function parseParameterList(paramString: string): { positional: unknown[], named: Record<string, unknown> } {
	if (!paramString.trim()) {
		return { positional: [], named: {} };
	}
	
	// Split by commas, but respect strings and nested structures
	const tokens = smartSplit(paramString);
	
	const positional: unknown[] = [];
	const named: Record<string, unknown> = {};
	
	for (const token of tokens) {
		const trimmed = token.trim();
		
		// Check if it's a named parameter (contains = at top level)
		const equalIndex = findTopLevelEqual(trimmed);
		
		if (equalIndex !== -1) {
			// Named parameter: key=value
			const key = trimmed.substring(0, equalIndex).trim();
			const valueStr = trimmed.substring(equalIndex + 1).trim();
			
			// Parse value as JSON
			try {
				named[key] = JSON.parse(valueStr);
			} catch (error) {
				throw new Error(`Invalid value for parameter '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		} else {
			// Positional parameter
			try {
				positional.push(JSON.parse(trimmed));
			} catch (error) {
				throw new Error(`Invalid positional parameter: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	}
	
	return { positional, named };
}

/**
 * Split parameter string by commas while respecting nested structures and strings
 */
function smartSplit(str: string): string[] {
	const result: string[] = [];
	let current = '';
	let depth = 0;
	let inString = false;
	let stringChar = '';
	
	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		const prevChar = i > 0 ? str[i - 1] : '';
		
		if (!inString && (char === '"' || char === "'")) {
			inString = true;
			stringChar = char;
		} else if (inString && char === stringChar && prevChar !== '\\') {
			inString = false;
		} else if (!inString) {
			if (char === '(' || char === '[' || char === '{') {
				depth++;
			} else if (char === ')' || char === ']' || char === '}') {
				depth--;
			} else if (char === ',' && depth === 0) {
				result.push(current);
				current = '';
				continue;
			}
		}
		
		current += char;
	}
	
	if (current.trim()) {
		result.push(current);
	}
	
	return result;
}

/**
 * Find the index of the first = character at the top level (not inside strings or nested structures)
 */
function findTopLevelEqual(str: string): number {
	let depth = 0;
	let inString = false;
	let stringChar = '';
	
	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		const prevChar = i > 0 ? str[i - 1] : '';
		
		if (!inString && (char === '"' || char === "'")) {
			inString = true;
			stringChar = char;
		} else if (inString && char === stringChar && prevChar !== '\\') {
			inString = false;
		} else if (!inString) {
			if (char === '(' || char === '[' || char === '{') {
				depth++;
			} else if (char === ')' || char === ']' || char === '}') {
				depth--;
			} else if (char === '=' && depth === 0) {
				return i;
			}
		}
	}
	
	return -1;
}

/**
 * Merge positional and named parameters into a single parameter object
 */
function mergeParameters(
	positional: unknown[], 
	named: Record<string, unknown>, 
	toolSchema?: any
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...named };
	
	if (toolSchema?.input_schema?.properties) {
		// Map positional to schema parameter names
		const paramNames = Object.keys(toolSchema.input_schema.properties);
		
		positional.forEach((value, index) => {
			if (index < paramNames.length) {
				const paramName = paramNames[index];
				// Named parameters take precedence over positional
				if (!(paramName in result)) {
					result[paramName] = value;
				}
			}
		});
	} else {
		// Fallback - use generic names
		positional.forEach((value, index) => {
			const paramName = `param${index}`;
			if (!(paramName in result)) {
				result[paramName] = value;
			}
		});
	}
	
	return result;
} 