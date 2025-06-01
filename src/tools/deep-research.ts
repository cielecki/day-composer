import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
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
  getActionText: (input: DeepResearchToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
    if (!input || typeof input !== 'object') return '';
    
    if (hasError) {
      return t('tools.deepResearch.errors.general', { error: t('tools.deepResearch.errors.researchFailed') });
    }
    
    if (hasCompleted) {
      if (input.query) {
        return t('tools.deepResearch.successWithQuery', { query: input.query });
      } else {
        return t('tools.deepResearch.success');
      }
    } else if (hasStarted) {
      if (input.query) {
        return t('tools.deepResearch.researching', { query: input.query });
      } else {
        return t('tools.deepResearch.researchingGeneric');
      }
    } else {
      if (input.query) {
        return t('tools.deepResearch.preparing', { query: input.query });
      } else {
        return t('tools.deepResearch.preparingGeneric');
      }
    }
  },
  execute: async (context: ToolExecutionContext<DeepResearchToolInput>): Promise<void> => {
    const { plugin, params, signal } = context;
    const { query, path, max_depth = 3, max_urls = 20, timeout = 180, overwrite = false } = params;
    
    try {
      const settings = getPluginSettings();

      // Check abort signal at start
      if (signal.aborted) throw new ToolExecutionError(t('tools.deepResearch.errors.aborted'));

      context.progress(t('tools.deepResearch.progress.validating'));

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

      // Check abort signal before loading library
      if (signal.aborted) throw new ToolExecutionError(t('tools.deepResearch.errors.aborted'));

      context.progress(t('tools.deepResearch.progress.loading'));

      // Dynamic import of Firecrawl to avoid bundling issues
      let FirecrawlApp;
      try {
        const firecrawlModule = await import('@mendable/firecrawl-js');
        FirecrawlApp = firecrawlModule.default;
      } catch (importError) {
        console.error('Failed to import Firecrawl:', importError);
        throw new ToolExecutionError(t('tools.deepResearch.errors.general', { error: t('tools.deepResearch.errors.libraryLoad') }));
      }

      // Check abort signal after library load
      if (signal.aborted) throw new ToolExecutionError(t('tools.deepResearch.errors.aborted'));

      // Initialize Firecrawl client
      const firecrawl = new FirecrawlApp({ apiKey: settings.firecrawlApiKey });

      // Configure research parameters
      const researchParams = {
        maxDepth: Math.min(Math.max(max_depth, 1), 10),
        timeLimit: Math.min(Math.max(timeout, 60), 300),
        maxUrls: Math.min(Math.max(max_urls, 5), 50)
      };

      console.log(`Starting deep research for query: "${query}" with params:`, researchParams);

      // Check abort signal before starting research
      if (signal.aborted) throw new ToolExecutionError(t('tools.deepResearch.errors.aborted'));

      context.progress(t('tools.deepResearch.progress.starting', { query }));

      // Activity callback to track progress and check abort signal
      const onActivity = (activity: any) => {
        if (signal.aborted) {
          throw new ToolExecutionError(t('tools.deepResearch.errors.aborted'));
        }
        
        const activityType = activity?.type || '';
        const message = activity?.message || '';
        
        if (message) {
          context.progress(message);
          console.log(`Research Progress [${activityType}]: ${message}`);
        }
      };

      // Track if research was explicitly cancelled
      let researchCancelled = false;
      
      // Set up abort listener for the research operation
      const abortListener = () => {
        console.log('Deep research received abort signal - cancelling research');
        researchCancelled = true;
        // Note: Unfortunately, Firecrawl doesn't appear to support AbortController directly
        // But we can still check our signal and exit early
      };
      
      signal.addEventListener('abort', abortListener);

      try {
        // Perform deep research
        const results = await firecrawl.deepResearch(query, researchParams, onActivity);

        // Check abort signal immediately after research completes
        if (signal.aborted || researchCancelled) {
          console.log('Research operation was aborted');
          throw new ToolExecutionError(t('tools.deepResearch.errors.aborted'));
        }

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

        // Check abort signal before processing results
        if (signal.aborted) throw new ToolExecutionError(t('tools.deepResearch.errors.aborted'));

        context.progress(t('tools.deepResearch.progress.processing'));

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
        
        // Check abort signal before saving
        if (signal.aborted) throw new ToolExecutionError(t('tools.deepResearch.errors.aborted'));
        
        context.progress(t('tools.deepResearch.progress.saving'));

        // Generate unique filename if file exists and overwrite is false
        let finalPath = path;
        if (await fileExists(path, plugin.app) && !overwrite) {
          finalPath = await generateUniqueFileName(plugin.app, path);
          console.log(`File exists, using unique name: ${finalPath}`);
        }

        // Final abort check before file creation
        if (signal.aborted) throw new ToolExecutionError(t('tools.deepResearch.errors.aborted'));

        // Save the research report to the specified file
        await createFile(finalPath, formattedResult, plugin.app);
        
        // Show completion notice to user
        new Notice(t('tools.deepResearch.success'), 4000);
        
        // Count sources for result summary
        const sourceCount = researchData.sources ? researchData.sources.length : 0;

        // Create navigation target for the research report
        context.addNavigationTarget({
          filePath: finalPath,
          description: t('tools.deepResearch.result.navigationDescription')
        });

        const resultMessage = t('tools.deepResearch.result.message', {
          query,
          path: finalPath,
          sourceCount: sourceCount.toString(),
          maxDepth: researchParams.maxDepth.toString()
        });

        context.progress(resultMessage);

      } finally {
        // Clean up abort listener
        signal.removeEventListener('abort', abortListener);
      }

    } catch (error) {
      console.error('Error in deep research tool:', error);
      
      // Handle abort errors specifically - throw ToolExecutionError for user-facing message
      if (error.name === 'AbortError' || signal.aborted) {
        console.log('Deep research was aborted');
        throw new ToolExecutionError(t('tools.deepResearch.errors.aborted'));
      }
      
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
