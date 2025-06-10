import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { t } from 'src/i18n';
import { handleCurrentlyOpenFileLink, handleCurrentlySelectedTextLink } from '../utils/links/special-link-handlers';

const schema = {
  name: "current_file_and_selection",
  description: "Returns information about the currently open file and any selected text within it. Provides file content and selection details in XML format for comprehensive context.",
  input_schema: {
    type: "object",
    properties: {},
    required: []
  }
};

type CurrentFileAndSelectionInput = Record<string, never>;

export const currentFileAndSelectionTool: ObsidianTool<CurrentFileAndSelectionInput> = {
  specification: schema,
  icon: "file-text",
  sideEffects: false, // Read-only operation, safe for link expansion
  get initialLabel() {
    return t('tools.currentFileAndSelection.label');
  },
  execute: async (context: ToolExecutionContext<CurrentFileAndSelectionInput>): Promise<void> => {
    const { plugin } = context;

    context.setLabel(t('tools.currentFileAndSelection.inProgress'));

    try {
      // Get both file content and selected text using original handlers
      const fileContent = await handleCurrentlyOpenFileLink(plugin.app);
      const selectedTextContent = handleCurrentlySelectedTextLink(plugin.app);
      
      // Add navigation target to the currently open file if available
      const activeFile = plugin.app.workspace.getActiveFile();
      if (activeFile) {
        context.addNavigationTarget({
          filePath: activeFile.path,
          description: t('tools.navigation.openCurrentFile')
        });
      }
      
      // Combine both pieces of information
      let combinedContent = `# Current File and Selection Context\n\n`;
      combinedContent += `## Currently Open File\n\n${fileContent}\n\n`;
      combinedContent += `## Text Selection\n\n${selectedTextContent}\n`;
      
      context.setLabel(t('tools.currentFileAndSelection.completed'));
      context.progress(combinedContent);

    } catch (error) {
      context.setLabel(t('tools.currentFileAndSelection.failed'));
      throw error;
    }
  }
}; 