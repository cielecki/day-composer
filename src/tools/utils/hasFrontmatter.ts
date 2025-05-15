/**
 * Checks if a file has frontmatter
 * @param content The file content
 * @returns True if the file has frontmatter, false otherwise
 */

export function hasFrontmatter(content: string): boolean {
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
  return frontmatterRegex.test(content);
}
