import { prepareFuzzySearch } from "obsidian";
import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";

const schema = {
  name: "search_vault",
  description: "Searches for documents in the vault matching the provided fuzzy query",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "the fuzzy query",
      }
    },
    required: ["query"]
  }
};

type SearchVaultToolInput = {
  query: string
}

export const searchVaultTool: ObsidianTool<SearchVaultToolInput> = {
  specification: schema,
  icon: "search",
  getActionText: (input: SearchVaultToolInput, output: string, hasResult: boolean) => {
    let actionText = '';
    
    if (!input || typeof input !== 'object') actionText = '';
    if (input.query) actionText = `"${input.query}"`;

    let resultPreview = '(search complete)';
    try {
      const data = JSON.parse(output);
      if (Array.isArray(data)) {
        resultPreview = data.length === 0 ? '(no results)' : `(${data.length} results)`;
      }
    } catch (e) {
      // Ignore parsing errors
    }

    if (hasResult) {
      return `Searched for ${actionText} ${resultPreview}`;
    } else {
      return `Searching for ${actionText}...`;
    }
  },
  execute: async (plugin: MyPlugin, params: SearchVaultToolInput): Promise<string> => {
    try {
      const { query } = params;
      
      // Ensure query is a string (handle null/undefined)
      const searchQuery = query || '';

      if (!searchQuery) {
        return 'Error: No search query provided';
      }
      
      const fuzzySearch = prepareFuzzySearch(searchQuery);
      
      // Get all markdown files from the vault
      const files = plugin.app.vault.getMarkdownFiles();
      const results = [];

      for (const file of files) {
        let shouldInclude = false;
        const filename = file.basename;
        const path = file.path;
        
        // Search in filename and path using fuzzy search
        const filenameMatch = fuzzySearch(filename);
        const pathMatch = fuzzySearch(path);
        
        if (filenameMatch || pathMatch) {
          shouldInclude = true;
        } else {
          // If no match in filename/path, check content
          try {
            const content = await plugin.app.vault.cachedRead(file);
            const contentMatch = fuzzySearch(content);
            
            if (contentMatch) {
              shouldInclude = true;
            }
          } catch (error) {
            console.error(`Error reading file ${file.path}:`, error);
          }
        }
        
        if (shouldInclude) {
          // Get metadata if available
          const metadata = plugin.app.metadataCache.getFileCache(file);
          
          results.push({
            path: file.path,
            name: file.basename,
            score: (filenameMatch?.score || 0) > (pathMatch?.score || 0) 
              ? filenameMatch?.score || 0 
              : pathMatch?.score || 0,
            matches: {
              filename: filenameMatch !== null,
              path: pathMatch !== null,
              content: !filenameMatch && !pathMatch
            },
            // Include headings if available
            headings: metadata?.headings?.map(h => ({ 
              text: h.heading,
              level: h.level
            })) || []
          });
        }
      }
      
      // Sort results by score (higher scores first)
      results.sort((a, b) => (b.score || 0) - (a.score || 0));

      return JSON.stringify(results);
    } catch (error) {
      console.error('Error searching vault:', error);
      return `Error searching vault: ${error.message || 'Unknown error'}`;
    }
  }
};
