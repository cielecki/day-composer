import { prepareFuzzySearch } from "obsidian";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';

const schema = {
  name: "vault_search",
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

type VaultSearchToolInput = {
  query: string
}

export const vaultSearchTool: ObsidianTool<VaultSearchToolInput> = {
  specification: schema,
  	icon: "search",
  sideEffects: false, // Read-only search operation, safe for link expansion
	  get initialLabel() {
    return t('tools.search.labels.initial');
  },
	execute: async (context: ToolExecutionContext<VaultSearchToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { query } = params;

    context.setLabel(t('tools.search.labels.inProgress', { query }));

    try {
      const files = plugin.app.vault.getMarkdownFiles();
      const results: { file: string; relevance: number; content: string; matches: any }[] = [];

      // Prepare the fuzzy search callback using Obsidian's API
      const fuzzySearchFn = prepareFuzzySearch(query);

      for (const file of files) {
        const content = await plugin.app.vault.read(file);
        
        // Search in file path using Obsidian's fuzzy search
        const pathResult = fuzzySearchFn(file.path);
        
        // Search in file content using Obsidian's fuzzy search
        const contentResult = fuzzySearchFn(content);
        
        let bestResult = null;
        let searchLocation = '';
        
        // Determine the best match between path and content
        if (pathResult && contentResult) {
          if (pathResult.score >= contentResult.score) {
            bestResult = pathResult;
            searchLocation = 'filename';
          } else {
            bestResult = contentResult;
            searchLocation = 'content';
          }
        } else if (pathResult) {
          bestResult = pathResult;
          searchLocation = 'filename';
        } else if (contentResult) {
          bestResult = contentResult;
          searchLocation = 'content';
        }
        
        if (bestResult) {
          // Get a content preview
          let preview = content;
          if (bestResult.matches && bestResult.matches.length > 0 && searchLocation === 'content') {
            // Find the first match and create a context around it
            const firstMatchStart = bestResult.matches[0][0];
            const contextStart = Math.max(0, firstMatchStart - 100);
            const contextEnd = Math.min(content.length, firstMatchStart + 200);
            preview = content.slice(contextStart, contextEnd);
            if (contextStart > 0) preview = '...' + preview;
            if (contextEnd < content.length) preview = preview + '...';
          } else {
            // Default preview - first 300 characters
            preview = content.slice(0, 300);
            if (content.length > 300) preview = preview + '...';
          }
          
          results.push({
            file: file.path,
            relevance: bestResult.score,
            content: preview,
            matches: bestResult.matches
          });
        }
      }

      // Sort by relevance (descending) and limit results
      results.sort((a, b) => b.relevance - a.relevance);
      const limitedResults = results.slice(0, 10);

      if (limitedResults.length === 0) {
        context.setLabel(t('tools.search.labels.noResults', { query }));
        context.progress(t('tools.search.progress.noResults', { query }));
        return;
      }

      // Create formatted result
      const resultText = limitedResults.map((result, index) => {
        const scoreText = `(score: ${result.relevance.toFixed(2)})`;
        const firstLine = result.content.split('\n')[0];
        return `${index + 1}. **${result.file}** ${scoreText}\n   ${firstLine}...`;
      }).join('\n\n');

      // Add navigation targets for each result
      limitedResults.forEach(result => {
        context.addNavigationTarget({
          filePath: result.file,
          description: `Open: ${result.file}`
        });
      });

      context.setLabel(t('tools.search.labels.completed', { query, count: limitedResults.length }));
      context.progress(resultText);
    } catch (error) {
      context.setLabel(t('tools.search.labels.failed', { query }));
      throw error;
    }
  }
};
