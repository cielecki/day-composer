import * as yaml from 'js-yaml';
import { LNMode } from '../../types/types';

// Define a type for frontmatter properties to avoid using 'any'
type FrontmatterValue = string | number | boolean | string[] | undefined;
type Frontmatter = Record<string, FrontmatterValue>;

/**
 * Converts an LNMode object to a markdown note string with frontmatter
 * @param mode The LNMode to convert to note content
 * @returns String containing the formatted note content with frontmatter
 */

export function modeToNoteContent(mode: LNMode): string {
  // Extract the system prompt content (not in frontmatter)
  const systemPrompt = mode.ln_system_prompt || '';

  // Create a clean object for frontmatter, removing undefined values and the system prompt
  const frontmatterObj: Frontmatter = {
    tags: 'ln-mode',
  };

  // Add all properties except system prompt, ln_path, and ln_name (which are determined at load time)
  Object.entries(mode).forEach(([key, value]) => {
    if (key !== 'ln_system_prompt' && key !== 'ln_path' && key !== 'ln_name' && value !== undefined) {
      frontmatterObj[key] = value;
    }
  });

  // Convert frontmatter object to YAML
  const frontmatterYaml = yaml.dump(frontmatterObj, {
    lineWidth: -1, // Don't wrap lines
    quotingType: '"', // Use double quotes
    forceQuotes: true // Force quotes around strings
  });

  // Combine frontmatter and system prompt
  return `---\n${frontmatterYaml}---\n\n${systemPrompt}`;
}
