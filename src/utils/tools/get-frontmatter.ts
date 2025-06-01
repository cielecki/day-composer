/**
 * Gets the frontmatter from a file content
 * @param content The file content
 * @returns The frontmatter if found, empty string otherwise
 */

export function getFrontmatter(content: string): string {
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
  const match = content.match(frontmatterRegex);
  return match ? match[0] : '';
}
