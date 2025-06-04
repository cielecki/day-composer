import { TFile } from "obsidian";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from '../types/chat-types';
import { t } from 'src/i18n';

const schema = {
  name: "vault_find_files_by_tag",
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

type VaultFindFilesByTagToolInput = {
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

export const vaultFindFilesByTagTool: ObsidianTool<VaultFindFilesByTagToolInput> = {
  specification: schema,
  icon: "tag",
  initialLabel: t('tools.findFilesByTag.label'),
  execute: async (context: ToolExecutionContext<VaultFindFilesByTagToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { tag } = params;
    
    context.setLabel(t('tools.findFilesByTag.inProgress', { tag }));

    try {
      // Get all files in the vault
      const allFiles = plugin.app.vault.getMarkdownFiles();
      
      // Filter files that have the specified tag
      const matchingFiles: { file: TFile, content: string }[] = [];
      
      for (const file of allFiles) {
        const fileCache = plugin.app.metadataCache.getFileCache(file);
        const tags = fileCache?.tags?.map(t => t.tag) || [];
        const frontmatterTags = fileCache?.frontmatter?.tags || [];
        
        // Combine both types of tags
        const allTags = [...tags, ...frontmatterTags].map(t => typeof t === 'string' ? t : t.tag || '');
        
        // Check if the tag matches (with or without # prefix)
        const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
        const tagWithoutHash = tag.startsWith('#') ? tag.slice(1) : tag;
        
        if (allTags.some(t => t === normalizedTag || t === tagWithoutHash)) {
          const content = await plugin.app.vault.read(file);
          matchingFiles.push({ file, content });
        }
      }
      
      if (matchingFiles.length === 0) {
        context.setLabel(t('tools.findFilesByTag.noResults', { tag }));
        context.progress(t('tools.findFilesByTag.noResults', { tag }));
        return;
      }
      
      // Create formatted result
      const resultLines: string[] = [];
      resultLines.push(t('tools.findFilesByTag.foundFiles', { count: matchingFiles.length, tag }));
      resultLines.push('');
      
      for (let i = 0; i < matchingFiles.length; i++) {
        const { file, content } = matchingFiles[i];
        resultLines.push(`${i + 1}. **${file.path}**`);
        
        // Show first few lines of content as preview
        const lines = content.split('\n').slice(0, 3);
        const preview = lines.join('\n').substring(0, 200);
        if (preview.length < content.length) {
          resultLines.push(`   ${preview}...`);
        } else {
          resultLines.push(`   ${preview}`);
        }
        resultLines.push('');
        
        // Add navigation target for each file
        context.addNavigationTarget({
          filePath: file.path,
          description: `Open: ${file.path}`
        });
      }
      
      const resultText = resultLines.join('\n');
      
      context.setLabel(t('tools.findFilesByTag.completed', { tag, count: matchingFiles.length }));
      context.progress(resultText);
    } catch (error) {
      context.setLabel(t('tools.findFilesByTag.failed', { tag }));
      throw error;
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