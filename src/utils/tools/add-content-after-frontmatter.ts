import { getFrontmatter } from '../../utils/tools/get-frontmatter';

/**
 * Adds content after frontmatter or at the beginning of the file
 * @param fileContent The current file content
 * @param contentToAdd The content to add
 * @returns The new file content
 */

export function addContentAfterFrontmatter(fileContent: string, contentToAdd: string): string {
  if (fileContent.trim() === '') {
    // File is empty
    return contentToAdd;
  }

  // Check for frontmatter
  const frontmatter = getFrontmatter(fileContent);

  if (frontmatter) {
    // File has frontmatter, insert after it
    return frontmatter + contentToAdd + '\n\n' + fileContent.slice(frontmatter.length);
  } else {
    // No frontmatter, insert at the beginning
    return contentToAdd + '\n\n' + fileContent;
  }
}
