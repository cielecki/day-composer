import { normalizeUnicode } from './unicode-normalizer';

/**
 * Sanitizes a string by converting international characters to ASCII equivalents
 * and replacing any remaining special characters with underscores.
 * Handles diacritics properly (e.g., ąćę → ace, ñ → n).
 * 
 * @param text The text to sanitize
 * @param options Optional configuration for sanitization
 * @returns Sanitized string safe for use as identifiers, filenames, etc.
 */
export function sanitizeString(text: string, options: {
  /** Whether to convert to lowercase (default: true) */
  lowercase?: boolean;
  /** Character to use for replacement (default: '_') */
  replacement?: string;
  /** Whether to allow spaces (default: false) */
  allowSpaces?: boolean;
  /** Whether to remove leading/trailing replacement characters (default: true) */
  trim?: boolean;
} = {}): string {
  const {
    lowercase = true,
    replacement = '_',
    allowSpaces = false,
    trim = true
  } = options;

  // Normalize Unicode and remove diacritics
  let result = normalizeUnicode(text);

  // Convert to lowercase if requested
  if (lowercase) {
    result = result.toLowerCase();
  }

  // Replace any remaining non-alphanumeric characters with replacement character
  // Include space in allowed characters if allowSpaces is true
  const allowedChars = allowSpaces ? 'a-zA-Z0-9\\s' : 'a-zA-Z0-9';
  const pattern = new RegExp(`[^${allowedChars}_]`, 'g');
  result = result.replace(pattern, replacement);

  // Remove consecutive replacement characters
  if (replacement !== ' ') {
    const escapedReplacement = replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`${escapedReplacement}+`, 'g'), replacement);
  }

  // Remove leading and trailing replacement characters if requested
  if (trim && replacement !== ' ') {
    const escapedReplacement = replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`^${escapedReplacement}+|${escapedReplacement}+$`, 'g'), '');
  }

  return result;
}

/**
 * Sanitizes a string for use as a tool name identifier.
 * Converts to lowercase, replaces international characters with ASCII equivalents,
 * and ensures the result is suitable for tool naming.
 * 
 * @param name The tool name to sanitize
 * @returns Sanitized tool name
 */
export function sanitizeToolName(name: string): string {
  return sanitizeString(name, {
    lowercase: true,
    replacement: '_',
    allowSpaces: false,
    trim: true
  });
}

/**
 * Sanitizes a string for use as a filename.
 * Handles international characters and removes/replaces problematic characters.
 * 
 * @param filename The filename to sanitize
 * @param options Optional configuration for filename sanitization
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string, options: {
  /** Whether to allow spaces (default: true for filenames) */
  allowSpaces?: boolean;
  /** Character to use for replacement (default: '_') */
  replacement?: string;
} = {}): string {
  const { allowSpaces = true, replacement = '_' } = options;
  
  return sanitizeString(filename, {
    lowercase: false, // Keep original case for filenames
    replacement,
    allowSpaces,
    trim: true
  });
}

/**
 * Extracts filename from a file path, removing the file extension
 * @param filePath The full file path
 * @returns Filename without extension
 */
export function extractFilenameWithoutExtension(filePath: string): string {
  // Get just the filename part (after last slash)
  const filename = filePath.split('/').pop() || filePath;
  
  // Remove the extension (everything after and including the last dot)
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex > 0) { // Don't remove dot if it's the first character (hidden files)
    return filename.substring(0, lastDotIndex);
  }
  
  return filename;
}

/**
 * Truncates text to a specified length and adds ellipsis
 * @param text The text to truncate
 * @param maxLength Maximum length before truncation (default: 50)
 * @param ellipsis The ellipsis character(s) to append (default: '...')
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 50, ellipsis: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - ellipsis.length) + ellipsis;
} 