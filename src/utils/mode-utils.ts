import { AICMode } from '../types/types';
import * as yaml from 'js-yaml';

// Define a type for frontmatter properties to avoid using 'any'
type FrontmatterValue = string | number | boolean | string[] | undefined;
type Frontmatter = Record<string, FrontmatterValue>;

/**
 * Converts an AICMode object to a markdown note string with frontmatter
 * @param mode The AICMode to convert to note content
 * @returns String containing the formatted note content with frontmatter
 */
export function modeToNoteContent(mode: AICMode): string {
  // Extract the system prompt content (not in frontmatter)
  const systemPrompt = mode.aic_system_prompt || '';
  
  // Create a clean object for frontmatter, removing undefined values and the system prompt
  const frontmatterObj: Frontmatter = {
    tags: 'aic-mode',
  };
  
  // Add all properties except system prompt and aic_path (which is determined at load time)
  Object.entries(mode).forEach(([key, value]) => {
    if (key !== 'aic_system_prompt' && key !== 'aic_path' && value !== undefined) {
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