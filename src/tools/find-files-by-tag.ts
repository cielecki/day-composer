import { TFile } from "obsidian";
import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";

const schema = {
  name: "find_files_by_tag",
  description: "Finds all files in the vault that contain specific tags. Supports both in-content tags (#tag) and frontmatter tags.",
  input_schema: {
    type: "object",
    properties: {
      tag: {
        type: "string",
        description: "The tag to search for (with or without #). For example: 'project' or '#project'"
      },
      include_frontmatter: {
        type: "boolean",
        description: "Whether to include files with tags in frontmatter",
        default: true
      },
      include_content: {
        type: "boolean", 
        description: "Whether to include files with tags in content",
        default: true
      },
      exact_match: {
        type: "boolean",
        description: "Whether to match the tag exactly or include nested tags (e.g., 'project' matches 'project/work')",
        default: false
      },
      include_file_content: {
        type: "boolean",
        description: "Whether to include a snippet of the file content in results",
        default: false
      },
      max_results: {
        type: "number",
        description: "Maximum number of results to return (0 for unlimited)",
        default: 50
      }
    },
    required: ["tag"]
  }
};

type FindFilesByTagToolInput = {
  tag: string;
  include_frontmatter?: boolean;
  include_content?: boolean;
  exact_match?: boolean;
  include_file_content?: boolean;
  max_results?: number;
}

interface TaggedFileResult {
  path: string;
  name: string;
  matchedTags: Array<{
    tag: string;
    location: 'content' | 'frontmatter';
    lineNumber?: number;
  }>;
  contentSnippet?: string;
  headings?: Array<{
    text: string;
    level: number;
  }>;
}

export const findFilesByTagTool: ObsidianTool<FindFilesByTagToolInput> = {
  specification: schema,
  icon: "tag",
  getActionText: (input: FindFilesByTagToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
    let tag = '';
    if (!input || typeof input !== 'object') return '';
    if (input.tag) tag = input.tag;

    if (hasError) {
      return t('tools.actions.findFilesByTag.failed', { tag });
    } else if (hasCompleted) {
      return t('tools.actions.findFilesByTag.completed', { tag });
    } else if (hasStarted) {
      return t('tools.actions.findFilesByTag.started', { tag });
    } else {
      return t('tools.actions.findFilesByTag.ready', { tag });
    }
  },
  execute: async (context: ToolExecutionContext<FindFilesByTagToolInput>): Promise<void> => {
    try {
      const { plugin, params } = context;
      const { 
        tag,
        include_frontmatter = true,
        include_content = true,
        exact_match = false,
        include_file_content = false,
        max_results = 50
      } = params;

      if (!tag) {
        throw new Error(t('tools.findFilesByTag.errors.tagRequired'));
      }

      // Normalize the tag - remove # if present and add it for searching
      const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
      const searchTag = `#${normalizedTag}`;

      // Get all markdown files from the vault
      const files = plugin.app.vault.getMarkdownFiles();
      const results: TaggedFileResult[] = [];
      
      for (const file of files) {

        // Check if we've reached max results
        if (max_results > 0 && results.length >= max_results) {
          break;
        }

        const matchedTags: TaggedFileResult['matchedTags'] = [];

        // Get metadata for this file
        const metadata = plugin.app.metadataCache.getFileCache(file);
        
        // Check frontmatter tags if enabled
        if (include_frontmatter && metadata?.frontmatter?.tags) {
          const frontmatterTags = Array.isArray(metadata.frontmatter.tags) 
            ? metadata.frontmatter.tags 
            : [metadata.frontmatter.tags];

          for (const fmTag of frontmatterTags) {
            const fmTagStr = String(fmTag);
            if (matchesTag(fmTagStr, normalizedTag, exact_match)) {
              matchedTags.push({
                tag: fmTagStr,
                location: 'frontmatter'
              });
            }
          }
        }

        // Check content tags if enabled
        if (include_content && metadata?.tags) {
          for (const tagCache of metadata.tags) {
            const contentTag = tagCache.tag.slice(1); // Remove the # prefix
            if (matchesTag(contentTag, normalizedTag, exact_match)) {
              matchedTags.push({
                tag: tagCache.tag,
                location: 'content',
                lineNumber: tagCache.position.start.line + 1
              });
            }
          }
        }

        // If we found matching tags, add this file to results
        if (matchedTags.length > 0) {
          const result: TaggedFileResult = {
            path: file.path,
            name: file.basename,
            matchedTags: matchedTags,
            headings: metadata?.headings?.map(h => ({
              text: h.heading,
              level: h.level
            })) || []
          };

          // Add content snippet if requested
          if (include_file_content) {
            try {
              const content = await plugin.app.vault.cachedRead(file);
              // Get first 200 characters, avoiding frontmatter
              const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '');
              result.contentSnippet = contentWithoutFrontmatter.slice(0, 200).trim() + 
                (contentWithoutFrontmatter.length > 200 ? '...' : '');
            } catch (error) {
              console.warn(`Could not read content for ${file.path}:`, error);
            }
          }

          results.push(result);
        }
      }

      // Format the results
      const formatResults = (): string => {
        let output = t('tools.findFilesByTag.results.header', { 
          count: results.length, 
          searchTag,
          plural: results.length !== 1 ? 's' : ''
        }) + '\n\n';

        if (results.length === 0) {
          output += t('tools.findFilesByTag.results.noFiles', { searchTag });
          if (!include_frontmatter || !include_content) {
            output += '\n\n' + t('tools.findFilesByTag.results.scopeLimited') + ' ';
            if (!include_frontmatter) output += t('tools.findFilesByTag.results.frontmatterExcluded') + ' ';
            if (!include_content) output += t('tools.findFilesByTag.results.contentExcluded') + ' ';
          }
          return output;
        }

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          output += `${i + 1}. **${result.name}**\n`;
          output += `   📍 ${t('tools.findFilesByTag.results.path')}: ${result.path}\n`;
          
          // Show matched tags
          output += `   🏷️  ${t('tools.findFilesByTag.results.tags')}: `;
          const tagsByLocation = result.matchedTags.reduce((acc, match) => {
            if (!acc[match.location]) acc[match.location] = [];
            const tagStr = match.lineNumber ? `${match.tag} (${t('tools.findFilesByTag.results.line')} ${match.lineNumber})` : match.tag;
            acc[match.location].push(tagStr);
            return acc;
          }, {} as Record<string, string[]>);

          const tagParts: string[] = [];
          if (tagsByLocation.frontmatter) {
            tagParts.push(`${t('tools.findFilesByTag.results.frontmatter')}: ${tagsByLocation.frontmatter.join(', ')}`);
          }
          if (tagsByLocation.content) {
            tagParts.push(`${t('tools.findFilesByTag.results.content')}: ${tagsByLocation.content.join(', ')}`);
          }
          output += tagParts.join(' | ') + '\n';

          // Show headings if available
          if (result.headings && result.headings.length > 0) {
            output += `   📋 ${t('tools.findFilesByTag.results.headings')}: ${result.headings.slice(0, 3).map(h => h.text).join(', ')}`;
            if (result.headings.length > 3) {
              output += ` (${t('tools.findFilesByTag.results.andMore', { count: result.headings.length - 3 })})`;
            }
            output += '\n';
          }

          // Show content snippet if included
          if (result.contentSnippet) {
            output += `   📄 ${t('tools.findFilesByTag.results.contentSnippet')}: ${result.contentSnippet}\n`;
          }

          output += '\n';
        }

        // Add search summary
        if (max_results > 0 && results.length >= max_results) {
          output += `\n⚠️  ${t('tools.findFilesByTag.results.limitedResults', { maxResults: max_results })}\n`;
        }

        return output;
      };

      const formattedResults = formatResults();
      context.progress(formattedResults);

      // Add navigation targets for the found files
      results.slice(0, 10).forEach((result, index) => { // Limit navigation targets to first 10
        context.addNavigationTarget({
          filePath: result.path,
          description: t('tools.findFilesByTag.navigation.description', { 
            index: index + 1, 
            name: result.name 
          })
        });
      });

    } catch (error) {
      console.error('Error finding files by tag:', error);
      throw new Error(t('tools.findFilesByTag.errors.general', { 
        error: error.message || t('tools.findFilesByTag.errors.unknown') 
      }));
    }
  }
};

// Helper function to check if a tag matches the search criteria
function matchesTag(candidateTag: string, searchTag: string, exactMatch: boolean): boolean {
  if (exactMatch) {
    return candidateTag.toLowerCase() === searchTag.toLowerCase();
  } else {
    // For non-exact match, check if the tag starts with the search tag
    // This handles nested tags like "project/work" matching "project"
    return candidateTag.toLowerCase().startsWith(searchTag.toLowerCase());
  }
} 