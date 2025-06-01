import { prepareFuzzySearch } from "obsidian";
import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";

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
  getActionText: (input: SearchVaultToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
    let actionText = '';
    
    if (!input || typeof input !== 'object') return '';
    if (input.query) actionText = `"${input.query}"`;

    if (hasError) {
      return `Failed to search for ${actionText}`;
    } else if (hasCompleted) {
      return `Searched for ${actionText}`;
    } else if (hasStarted) {
      return `Searching for ${actionText}...`;
    } else {
      return `Search for ${actionText}`;
    }
  },
  execute: async (context: ToolExecutionContext<SearchVaultToolInput>): Promise<void> => {
    try {
      const { plugin, params } = context;
      const { query } = params;
      
      context.progress("Preparing search...");
      
      // Ensure query is a string (handle null/undefined)
      const searchQuery = query || '';

      if (!searchQuery) {
        throw new Error('No search query provided');
      }
      
      const fuzzySearch = prepareFuzzySearch(searchQuery);
      
      context.progress("Getting files from vault...");
      
      // Get all markdown files from the vault
      const files = plugin.app.vault.getMarkdownFiles();
      const results = [];

      context.progress(`Searching through ${files.length} files...`);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Update progress periodically
        if (i % 50 === 0) {
          context.progress(`Processing file ${i + 1}/${files.length}...`);
        }
        
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
      
      context.progress("Sorting search results...");
      
      // Sort results by score (higher scores first)
      results.sort((a, b) => (b.score || 0) - (a.score || 0));

      const resultCount = results.length;
      const resultMessage = resultCount === 0 
        ? `No results found for "${query}"` 
        : `Found ${resultCount} result${resultCount > 1 ? 's' : ''} for "${query}":\n\n${JSON.stringify(results, null, 2)}`;

      context.progress(resultMessage);
    } catch (error) {
      console.error('Error searching vault:', error);
      throw new Error(`Error searching vault: ${error.message || 'Unknown error'}`);
    }
  }
};
