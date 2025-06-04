import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from '../types/chat-types';
import { ToolExecutionError } from '../types/tool-execution-error';
import { getStore } from "../store/plugin-store";
import { formatConversationContent } from "../utils/chat/conversation-formatter";
import { createFile } from "../utils/fs/create-file";
import { fileExists } from "../utils/fs/file-exists";
import { t } from 'src/i18n';

const schema = {
  name: "conversation_save",
  description: "Saves the current conversation to a note in the vault. The conversation will be formatted with user and assistant message sections and saved as a markdown file.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path where the conversation note should be saved (including filename with .md extension). If not provided, will use a default path based on the conversation title.",
      },
      title: {
        type: "string",
        description: "Optional title for the conversation note. If not provided, will use the current conversation title or generate one.",
      },
      include_metadata: {
        type: "boolean",
        description: "Whether to include metadata (date, mode) at the top of the note",
        default: true
      },
      auto_version: {
        type: "boolean",
        description: "If true, automatically create a versioned filename if the file already exists (e.g., 'conversation.md' becomes 'conversation 2.md')",
        default: true
      },
    },
    required: []
  }
};

type ConversationSaveToolInput = {
  path?: string;
  title?: string;
  include_metadata?: boolean;
  auto_version?: boolean;
}

async function getVersionedPath(basePath: string, app: any): Promise<string> {
  const pathParts = basePath.split('.');
  const extension = pathParts.pop() || '';
  const baseName = pathParts.join('.');
  
  let versionNumber = 2;
  let versionedPath = `${baseName} ${versionNumber}.${extension}`;
  
  while (await fileExists(versionedPath, app)) {
    versionNumber++;
    versionedPath = `${baseName} ${versionNumber}.${extension}`;
  }
  
  return versionedPath;
}

function generateDefaultPath(title: string): string {
  // Clean the title for use as filename
  const cleanTitle = title
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 100); // Limit length
  
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  return `Conversations/${timestamp} - ${cleanTitle}.md`;
}

export const conversationSaveTool: ObsidianTool<ConversationSaveToolInput> = {
  specification: schema,
  icon: "save",
  initialLabel: t('tools.conversationSave.label'),
  execute: async (context: ToolExecutionContext<ConversationSaveToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { path, title, include_metadata = true, auto_version = true } = params;

    context.setLabel(t('tools.conversationSave.inProgress'));

    try {
      // Get the current conversation from the store
      const store = getStore();
      const conversation = store.chats.current.storedConversation.messages;
      const conversationTitle = title || store.chats.current.meta.title || 'Untitled Conversation';

      if (!conversation || conversation.length === 0) {
        throw new ToolExecutionError(t('tools.conversationSave.progress.empty'));
      }

      // Generate the file path if not provided
      const finalPath = path || generateDefaultPath(conversationTitle);

      // Check if file exists and handle versioning
      let targetPath = finalPath;
      const exists = await fileExists(finalPath, plugin.app);
      
      if (exists) {
        if (auto_version) {
          targetPath = await getVersionedPath(finalPath, plugin.app);
          context.progress(t('tools.conversationSave.progress.versionedFile', { path: targetPath }));
        } else {
          throw new ToolExecutionError(t('tools.conversationSave.progress.fileExists', { path: finalPath }));
        }
      }

      // Format the conversation content
      const formattedConversation = formatConversationContent(conversation);
      
      // Build the complete note content
      let noteContent = '';
      
      if (include_metadata) {
        const currentDate = new Date().toLocaleString();
        const activeMode = store.modes.available[store.modes.activeId];
        const modeName = activeMode ? activeMode.ln_name : 'Unknown';
        
        noteContent += `# ${conversationTitle}\n\n`;
        noteContent += `**Date:** ${currentDate}\n`;
        noteContent += `**Mode:** ${modeName}\n`;
        noteContent += `**Messages:** ${conversation.length}\n\n`;
        noteContent += `---\n\n`;
      }
      
      noteContent += formattedConversation;

      // Create the file
      await createFile(targetPath, noteContent, plugin.app);

      // Add navigation target
      context.addNavigationTarget({
        filePath: targetPath,
        description: t('tools.conversationSave.navigation.openSavedConversation')
      });

      context.setLabel(t('tools.conversationSave.completed', { path: targetPath }));
      context.progress(t('tools.conversationSave.progress.success', { count: conversation.length, path: targetPath }));
      
    } catch (error) {
      context.setLabel(t('tools.conversationSave.failed'));
      throw error;
    }
  }
}; 