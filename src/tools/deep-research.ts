import MyPlugin from "../main";
import { ObsidianTool, NavigationTarget, ToolExecutionResult } from "../obsidian-tools";
import { getPluginSettings } from "../settings/PluginSettings";
import { t } from "../i18n";
import { Notice } from "obsidian";
import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { generateUniqueFileName } from "../utils/tools/generate-unique-file-name";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";

const schema = {
  name: "deep_research",
  description: "Conducts comprehensive web research on a given topic using Firecrawl's deep research capabilities. Searches multiple sources, extracts relevant information, and synthesizes findings into a detailed report with citations. Saves the research report to a specified file.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The research query or topic to investigate thoroughly"
      },
      path: {
        type: "string",
        description: "The path where the research report should be saved (including filename with .md extension)"
      },
      max_depth: {
        type: "number",
        description: "Maximum depth of research iterations (1-10, default: 3)",
        minimum: 1,
        maximum: 10
      },
      max_urls: {
        type: "number", 
        description: "Maximum number of URLs to analyze (5-50, default: 20)",
        minimum: 5,
        maximum: 50
      },
      timeout: {
        type: "number",
        description: "Timeout in seconds for the research process (60-300, default: 180)",
        minimum: 60,
        maximum: 300
      },
      overwrite: {
        type: "boolean",
        description: "Whether to overwrite the file if it already exists. Defaults to false",
        default: false
      }
    },
    required: ["query", "path"]
  }
};

type DeepResearchToolInput = {
  query: string;
  path: string;
  max_depth?: number;
  max_urls?: number;
  timeout?: number;
  overwrite?: boolean;
}

export const deepResearchTool: ObsidianTool<DeepResearchToolInput> = {
  specification: schema,
  icon: "search",
  getActionText: (input: DeepResearchToolInput, output: string, hasResult: boolean, hasError: boolean) => {
    if (!input || typeof input !== 'object') return '';
    
    if (hasError) {
      return t('tools.deepResearch.errors.general', { error: t('tools.deepResearch.errors.researchFailed') });
    }
    
    if (hasResult) {
      return `${t('tools.deepResearch.success')} for "${input.query}"`;
    } else {
      return t('tools.deepResearch.researching', { query: input.query });
    }
  },
  execute: async (plugin: MyPlugin, params: DeepResearchToolInput): Promise<ToolExecutionResult> => {
    try {
      const { query, path, max_depth = 3, max_urls = 20, timeout = 180, overwrite = false } = params;
      const settings = getPluginSettings();

      // Validate inputs
      if (!query || query.trim().length === 0) {
        throw new ToolExecutionError(t('tools.deepResearch.errors.emptyQuery'));
      }

      if (!path || path.trim().length === 0) {
        throw new ToolExecutionError(t('tools.deepResearch.errors.emptyPath'));
      }

      if (!settings.firecrawlApiKey || settings.firecrawlApiKey.trim().length === 0) {
        throw new ToolExecutionError(t('tools.deepResearch.errors.noApiKey'));
      }

      // Dynamic import of Firecrawl to avoid bundling issues
      let FirecrawlApp;
      try {
        const firecrawlModule = await import('@mendable/firecrawl-js');
        FirecrawlApp = firecrawlModule.default;
      } catch (importError) {
        console.error('Failed to import Firecrawl:', importError);
        throw new ToolExecutionError(t('tools.deepResearch.errors.general', { error: t('tools.deepResearch.errors.libraryLoad') }));
      }

      // Initialize Firecrawl client
      const firecrawl = new FirecrawlApp({ apiKey: settings.firecrawlApiKey });

      // Configure research parameters
      const researchParams = {
        maxDepth: Math.min(Math.max(max_depth, 1), 10),
        timeLimit: Math.min(Math.max(timeout, 60), 300),
        maxUrls: Math.min(Math.max(max_urls, 5), 50)
      };

      console.log(`Starting deep research for query: "${query}" with params:`, researchParams);

      // Show start notice to user
      new Notice(t('tools.deepResearch.researching', { query }), 4000);

      // Activity callback to track progress
      const onActivity = (activity: any) => {
        const activityType = activity?.type || '';
        const message = activity?.message || '';
        
        if (message) {
          // Show progress to user via Notice
          new Notice(message, 3000); // Show for 3 seconds
          console.log(`Research Progress [${activityType}]: ${message}`);
        }
      };

      // Perform deep research
      const results = await firecrawl.deepResearch(query, researchParams, onActivity);

      if (!results || !results.success) {
        const errorMsg = results?.error || t('tools.deepResearch.errors.unknownError');
        console.error('Deep research failed:', errorMsg);
        
        // Handle specific error types
        if (errorMsg.includes('quota') || errorMsg.includes('limit')) {
          throw new ToolExecutionError(t('tools.deepResearch.errors.quotaExceeded'));
        } else if (errorMsg.includes('timeout')) {
          throw new ToolExecutionError(t('tools.deepResearch.errors.timeout'));
        } else {
          throw new ToolExecutionError(t('tools.deepResearch.errors.general', { error: errorMsg }));
        }
      }

      // Extract research data
      const researchData = results.data;
      if (!researchData) {
        throw new ToolExecutionError(t('tools.deepResearch.errors.noResults'));
      }

      // Format the research results
      let formattedResult = `# ${t('tools.deepResearch.headers.results')}: ${query}\n\n`;
      
      // Add research summary/analysis if available
      if (researchData.finalAnalysis) {
        formattedResult += `## ${t('tools.deepResearch.headers.analysis')}\n\n${researchData.finalAnalysis}\n\n`;
      }

      // Add sources if available
      if (researchData.sources && researchData.sources.length > 0) {
        formattedResult += `## ${t('tools.deepResearch.headers.sources')} (${researchData.sources.length})\n\n`;
        researchData.sources.forEach((source: any, index: number) => {
          const title = source.title || source.url || `${t('tools.deepResearch.labels.source')} ${index + 1}`;
          const url = source.url || '';
          const description = source.description || '';
          
          formattedResult += `${index + 1}. **${title}**\n`;
          if (url) {
            formattedResult += `   - ${t('tools.deepResearch.labels.url')}: ${url}\n`;
          }
          if (description) {
            formattedResult += `   - ${description}\n`;
          }
          formattedResult += '\n';
        });
      }

      // Add research metadata
      formattedResult += `## ${t('tools.deepResearch.headers.metadata')}\n\n`;
      formattedResult += `- **${t('tools.deepResearch.labels.query')}**: ${query}\n`;
      formattedResult += `- **${t('tools.deepResearch.labels.maxDepth')}**: ${researchParams.maxDepth}\n`;
      formattedResult += `- **${t('tools.deepResearch.labels.maxUrls')}**: ${researchParams.maxUrls}\n`;
      formattedResult += `- **${t('tools.deepResearch.labels.timeout')}**: ${researchParams.timeLimit}s\n`;
      if (researchData.sources) {
        formattedResult += `- **${t('tools.deepResearch.labels.sourcesFound')}**: ${researchData.sources.length}\n`;
      }
      formattedResult += `- **${t('tools.deepResearch.labels.completed')}**: ${new Date().toISOString()}\n\n`;

      console.log('Deep research completed successfully');
      
      // Generate unique filename if file exists and overwrite is false
      let finalPath = path;
      if (await fileExists(path, plugin.app) && !overwrite) {
        finalPath = await generateUniqueFileName(plugin.app, path);
        console.log(`File exists, using unique name: ${finalPath}`);
      }

      // Save the research report to the specified file
      await createFile(finalPath, formattedResult, plugin.app);
      
      // Show completion notice to user
      new Notice(t('tools.deepResearch.success'), 4000);
      
      // Count sources for result summary
      const sourceCount = researchData.sources ? researchData.sources.length : 0;
      const resultMessage = t('tools.deepResearch.result.message', {
        query,
        path: finalPath,
        sourceCount: sourceCount.toString(),
        maxDepth: researchParams.maxDepth.toString()
      });

      // Create navigation target for the research report
      const navigationTargets: NavigationTarget[] = [{
        filePath: finalPath,
        description: t('tools.deepResearch.result.navigationDescription')
      }];

      return {
        result: resultMessage,
        navigationTargets: navigationTargets
      };

    } catch (error) {
      console.error('Error in deep research tool:', error);
      
      // Handle ToolExecutionError (already properly formatted)
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      
      // Handle other errors
      const errorMessage = error.message || String(error);
      
      if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
        throw new ToolExecutionError(t('tools.deepResearch.errors.noApiKey'));
      } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        throw new ToolExecutionError(t('tools.deepResearch.errors.quotaExceeded'));
      } else if (errorMessage.includes('timeout')) {
        throw new ToolExecutionError(t('tools.deepResearch.errors.timeout'));
      } else {
        throw new ToolExecutionError(t('tools.deepResearch.errors.general', { error: errorMessage }));
      }
    }
  }
};
