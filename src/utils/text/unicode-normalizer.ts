/**
 * Normalizes Unicode text by decomposing characters and removing diacritics.
 * Converts characters like ąćę to ace, ñ to n, etc.
 * 
 * @param text The text to normalize
 * @returns Text with diacritics removed and normalized to ASCII equivalents
 */
export function normalizeUnicode(text: string): string {
  return text
    .normalize('NFKD') // Decompose characters into base + diacritics
    .replace(/[\u0300-\u036f]/g, ''); // Remove combining diacritical marks
}

/**
 * Normalizes Unicode text and additionally converts to lowercase.
 * 
 * @param text The text to normalize
 * @returns Lowercase text with diacritics removed
 */
export function normalizeUnicodeLowercase(text: string): string {
  return normalizeUnicode(text).toLowerCase();
} 