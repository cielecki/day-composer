import { prepareFuzzySearch } from "obsidian";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { t } from "../i18n";

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
  initialLabel: t('tools.search.label'),
  execute: async (context: ToolExecutionContext<VaultSearchToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { query } = params;

    context.setLabel(t('tools.search.inProgress', { query }));

    try {
      const files = plugin.app.vault.getMarkdownFiles();
      const results: { file: string; relevance: number; content: string }[] = [];

      for (const file of files) {
        const content = await plugin.app.vault.read(file);
        
        // Simple search - check if query appears in content (case insensitive)
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        
        if (lowerContent.includes(lowerQuery)) {
          // Simple relevance scoring based on number of matches
          const matches = (lowerContent.match(new RegExp(lowerQuery, 'g')) || []).length;
          results.push({
            file: file.path,
            relevance: matches,
            content: content.slice(0, 500) // First 500 characters as preview
          });
        }
      }

      // Sort by relevance (descending) and limit results
      results.sort((a, b) => b.relevance - a.relevance);
      const limitedResults = results.slice(0, 10);

      if (limitedResults.length === 0) {
        context.setLabel(t('tools.search.noResults', { query }));
        context.progress(t('tools.search.noResults', { query }));
        return;
      }

      // Create formatted result
      const resultText = limitedResults.map((result, index) => 
        `${index + 1}. **${result.file}** (${result.relevance} matches)\n   ${result.content.split('\n')[0]}...`
      ).join('\n\n');

      // Add navigation targets for each result
      limitedResults.forEach(result => {
        context.addNavigationTarget({
          filePath: result.file,
          description: `Open: ${result.file}`
        });
      });

      context.setLabel(t('tools.search.completed', { query, count: limitedResults.length }));
      context.progress(resultText);
    } catch (error) {
      context.setLabel(t('tools.search.failed', { query }));
      throw error;
    }
  }
};
