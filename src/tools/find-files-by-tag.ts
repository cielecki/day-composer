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
    const tag = input?.tag ? `"${input.tag}"` : "";
    
    if (hasError) {
      return `Failed to find files with tag ${tag}`;
    } else if (hasCompleted) {
      return `Found files with tag ${tag}`;
    } else if (hasStarted) {
      return `Finding files with tag ${tag}...`;
    } else {
      return `Find files with tag ${tag}`;
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
        throw new Error('Tag parameter is required');
      }

      context.progress("Preparing tag search...");

      // Normalize the tag - remove # if present and add it for searching
      const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
      const searchTag = `#${normalizedTag}`;

      context.progress(`Searching for tag: ${searchTag}...`);

      // Get all markdown files from the vault
      const files = plugin.app.vault.getMarkdownFiles();
      const results: TaggedFileResult[] = [];
      let processedCount = 0;

      for (const file of files) {
        // Update progress periodically
        if (processedCount % 25 === 0) {
          context.progress(`Processing file ${processedCount + 1}/${files.length}...`);
        }
        processedCount++;

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

      context.progress("Formatting results...");

      // Format the results
      const formatResults = (): string => {
        let output = `Found ${results.length} file${results.length !== 1 ? 's' : ''} with tag "${searchTag}":\n\n`;

        if (results.length === 0) {
          output += `No files found with tag "${searchTag}".`;
          if (!include_frontmatter || !include_content) {
            output += '\n\nNote: Search scope was limited. ';
            if (!include_frontmatter) output += 'Frontmatter tags were excluded. ';
            if (!include_content) output += 'Content tags were excluded. ';
          }
          return output;
        }

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          output += `${i + 1}. **${result.name}**\n`;
          output += `   📍 Path: ${result.path}\n`;
          
          // Show matched tags
          output += `   🏷️  Tags: `;
          const tagsByLocation = result.matchedTags.reduce((acc, match) => {
            if (!acc[match.location]) acc[match.location] = [];
            const tagStr = match.lineNumber ? `${match.tag} (line ${match.lineNumber})` : match.tag;
            acc[match.location].push(tagStr);
            return acc;
          }, {} as Record<string, string[]>);

          const tagParts: string[] = [];
          if (tagsByLocation.frontmatter) {
            tagParts.push(`frontmatter: ${tagsByLocation.frontmatter.join(', ')}`);
          }
          if (tagsByLocation.content) {
            tagParts.push(`content: ${tagsByLocation.content.join(', ')}`);
          }
          output += tagParts.join(' | ') + '\n';

          // Show headings if available
          if (result.headings && result.headings.length > 0) {
            output += `   📋 Headings: ${result.headings.slice(0, 3).map(h => h.text).join(', ')}`;
            if (result.headings.length > 3) {
              output += ` (and ${result.headings.length - 3} more)`;
            }
            output += '\n';
          }

          // Show content snippet if included
          if (result.contentSnippet) {
            output += `   📄 Content: ${result.contentSnippet}\n`;
          }

          output += '\n';
        }

        // Add search summary
        if (max_results > 0 && results.length >= max_results) {
          output += `\n⚠️  Results limited to ${max_results} files. There may be more files with this tag.\n`;
        }

        return output;
      };

      const formattedResults = formatResults();
      context.progress(formattedResults);

      // Add navigation targets for the found files
      results.slice(0, 10).forEach((result, index) => { // Limit navigation targets to first 10
        context.addNavigationTarget({
          filePath: result.path,
          description: `Navigate to file ${index + 1}: ${result.name}`
        });
      });

    } catch (error) {
      console.error('Error finding files by tag:', error);
      throw new Error(`Error finding files by tag: ${error.message || 'Unknown error'}`);
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