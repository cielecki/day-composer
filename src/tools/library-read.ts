import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { 
  isLocalDevelopmentMode, 
  getPluginVersion, 
  readLocalLibraryContent, 
  fetchRemoteLibraryContent 
} from '../utils/library/library-access';
import { extractFilenameWithoutExtension } from "src/utils/text/string-sanitizer";

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
      
      let content: string;
      let sourceInfo: string;
      
      // Check if we're in local development mode
      const isLocalDev = await isLocalDevelopmentMode();
      
      if (isLocalDev) {
        console.debug(`Reading from local library: ${cleanPath}`);
        content = await readLocalLibraryContent(cleanPath);
        sourceInfo = "**Source:** Local development library";
      } else {
        console.debug(`Fetching from remote library: ${cleanPath}`);
        content = await fetchRemoteLibraryContent(cleanPath);
        const pluginVersion = await getPluginVersion();
        sourceInfo = `**Source:** GitHub repository (version ${pluginVersion})`;
      }

      const fileName = cleanPath.split('/').pop() || 'library-content.md';

      console.debug(`Loaded: ${fileName} (${content.length} characters)`);

      // Display the content with basic formatting
      let formattedContent = `# ${fileName}\n\n`;
      formattedContent += `**Path:** ${cleanPath}\n`;
      formattedContent += `${sourceInfo}\n`;
      formattedContent += `**Size:** ${content.length} characters\n\n`;
      formattedContent += `---\n\n`;
      formattedContent += content;

      // Display the formatted content
      context.setLabel(t('tools.library.read.completed', { path: extractFilenameWithoutExtension(cleanPath) }));
      context.progress(formattedContent);

    } catch (error) {
      context.setLabel(t('tools.library.read.failed', { path }));
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      throw new ToolExecutionError(`Failed to read ${path}: ${error.message || String(error)}`);
    }
  }
}; 