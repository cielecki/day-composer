import { normalizeUnicodeLowercase } from './unicode-normalizer';

/**
 * Converts a string to a valid XML tag name by replacing non-ASCII characters
 * with their ASCII equivalents and ensuring the result is a valid XML tag name
 * @param text The text to convert
 * @returns A valid XML tag name
 */
export function convertToValidTagName(text: string): string {
	// Normalize Unicode, remove diacritics, and convert to lowercase
	let result = normalizeUnicodeLowercase(text);

	// Replace any remaining non-alphanumeric characters with underscores
	result = result.replace(/[^a-z0-9]/g, '_');

	// Remove consecutive underscores
	result = result.replace(/_+/g, '_');

	// Remove leading and trailing underscores
	result = result.replace(/^_+|_+$/g, '');
	
	// Ensure the tag name starts with a valid XML NameStartChar (letter or underscore)
	if (!/^[a-z_]/.test(result)) {
		result = '_' + result;
	}

	return result;
} 