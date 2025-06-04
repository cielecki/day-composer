import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from '../types/chat-types';
import { t } from 'src/i18n';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { requestUrl } from "obsidian";

const schema = {
  name: "library_view",
  description: "Download and preview Life Navigator library content using relative paths from library_list",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Relative path to library content (e.g., 'modes/assistant.md', 'tools/weather.md')",
      },
      save_to_vault: {
        type: "boolean",
        description: "Whether to save the content as a file in your vault (default: false)",
        default: false
      },
      filename: {
        type: "string",
        description: "Optional custom filename when saving to vault (auto-generated if not provided)"
      }
    },
    required: ["path"]
  }
};

type LibraryViewInput = {
  path: string;
  save_to_vault?: boolean;
  filename?: string;
};

// Life Navigator repository configuration
const LIFE_NAVIGATOR_REPO = 'cielecki/life-navigator';
const LIBRARY_PATH = 'library';

export const libraryViewTool: ObsidianTool<LibraryViewInput> = {
  specification: schema,
  icon: "eye",
  get initialLabel() {
    return t('tools.library.view.label');
  },
  execute: async (context: ToolExecutionContext<LibraryViewInput>): Promise<void> => {
    const { params } = context;
    const { path, save_to_vault = false, filename } = params;

    context.setLabel(t('tools.library.view.inProgress'));

    try {
      // Clean up the path
      const cleanPath = path.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
      
      // Construct the full raw GitHub URL
      const [owner, repo] = LIFE_NAVIGATOR_REPO.split('/');
      const fullPath = `${LIBRARY_PATH}/${cleanPath}`;
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${fullPath}`;

      context.progress(`Fetching content from library: ${cleanPath}`);

      // Download content from URL
      const response = await requestUrl({
        url: rawUrl,
        method: 'GET',
        headers: {
          'User-Agent': 'Life Navigator Obsidian Plugin'
        }
      });

      // Check if request was successful
      if (response.status !== 200) {
        context.setLabel(t('tools.library.view.failed'));
        throw new ToolExecutionError(`Failed to download ${cleanPath}. Status: ${response.status} (file may not exist)`);
      }

      const content = response.text;
      const fileName = cleanPath.split('/').pop() || 'library-content.md';

      context.progress(`Downloaded: ${fileName} (${content.length} characters)`);

      // Save to vault if requested
      if (save_to_vault) {
        const saveFilename = filename || `Library - ${fileName}`;
        
        context.progress(`Saving to vault as: ${saveFilename}`);
        
        try {
          await context.plugin.app.vault.create(saveFilename, content);
          
          context.addNavigationTarget({
            filePath: saveFilename,
            description: `Open saved content`
          });
          
          context.progress(`✅ Saved to vault: ${saveFilename}`);
        } catch (saveError) {
          context.progress(`⚠️ Could not save to vault (file may already exist): ${saveError.message}`);
        }
      }

      // Display the content with basic formatting
      let formattedContent = `# ${fileName}\n\n`;
      formattedContent += `**Path:** ${cleanPath}\n`;
      formattedContent += `**Size:** ${content.length} characters\n\n`;
      formattedContent += `---\n\n`;
      formattedContent += content;

      // Display the formatted content
      context.setLabel(t('tools.library.view.completed'));
      context.progress(formattedContent);

    } catch (error) {
      context.setLabel(t('tools.library.view.failed'));
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      throw new ToolExecutionError(`Failed to download ${path}: ${error.message || String(error)}`);
    }
  }
}; 