import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { requestUrl } from "obsidian";

const schema = {
  name: "library_read",
  description: "Download and read template / example content from the remote Life Navigator library. Use vault tools (like note_read, vault_find) to read user's actual files.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Relative path to library content (e.g., 'modes/assistant.md', 'tools/weather.md')",
      }
    },
    required: ["path"]
  }
};

type LibraryReadInput = {
  path: string;
};

// Life Navigator repository configuration
const LIFE_NAVIGATOR_REPO = 'cielecki/life-navigator';
const LIBRARY_PATH = 'library';

export const libraryReadTool: ObsidianTool<LibraryReadInput> = {
  specification: schema,
  icon: "file-text",
  sideEffects: false, // Read-only operation, safe for link expansion
  get initialLabel() {
    return t('tools.library.read.label');
  },
  execute: async (context: ToolExecutionContext<LibraryReadInput>): Promise<void> => {
    const { params } = context;
    const { path } = params;

    context.setLabel(t('tools.library.read.inProgress', { path }));

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
        context.setLabel(t('tools.library.read.failed', { path: cleanPath }));
        throw new ToolExecutionError(`Failed to download ${cleanPath}. Status: ${response.status} (file may not exist)`);
      }

      const content = response.text;
      const fileName = cleanPath.split('/').pop() || 'library-content.md';

      context.progress(`Downloaded: ${fileName} (${content.length} characters)`);

      // Display the content with basic formatting
      let formattedContent = `# ${fileName}\n\n`;
      formattedContent += `**Path:** ${cleanPath}\n`;
      formattedContent += `**Size:** ${content.length} characters\n\n`;
      formattedContent += `---\n\n`;
      formattedContent += content;

      // Display the formatted content
      context.setLabel(t('tools.library.read.completed', { path: cleanPath }));
      context.progress(formattedContent);

    } catch (error) {
      context.setLabel(t('tools.library.read.failed', { path }));
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      throw new ToolExecutionError(`Failed to download ${path}: ${error.message || String(error)}`);
    }
  }
}; 