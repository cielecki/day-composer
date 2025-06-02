import { TFile, TFolder, normalizePath } from "obsidian";
import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
import { ToolExecutionError } from "../utils/tools/tool-execution-error";
import { t } from "../i18n";

const schema = {
  name: "list_directory",
  description: "Lists files and directories in a given vault path. Can list recursively to show the complete directory structure.",
  input_schema: {
    type: "object",
    properties: {
      directory_path: {
        type: "string",
        description: "The directory path to list (leave empty or use '.' for vault root)",
        default: ""
      },
      recursive: {
        type: "boolean",
        description: "Whether to list subdirectories recursively",
        default: false
      },
      include_files: {
        type: "boolean", 
        description: "Whether to include files in the listing",
        default: true
      },
      include_folders: {
        type: "boolean",
        description: "Whether to include folders in the listing", 
        default: true
      },
      file_types: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Filter by file types (e.g., ['md', 'pdf', 'png']). Leave empty for all types."
      }
    },
    required: []
  }
};

type ListDirectoryToolInput = {
  directory_path?: string;
  recursive?: boolean;
  include_files?: boolean;
  include_folders?: boolean;
  file_types?: string[];
}

interface DirectoryItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
  size?: number;
  children?: DirectoryItem[];
}

export const listDirectoryTool: ObsidianTool<ListDirectoryToolInput> = {
  specification: schema,
  icon: "folder",
  initialLabel: t('tools.listDirectory.label'),
  execute: async (context: ToolExecutionContext<ListDirectoryToolInput>): Promise<void> => {
    const { plugin, params } = context;
    const { directory_path = "", recursive = false, include_files = true, include_folders = true, file_types = [] } = params;
    
    context.setLabel(t('tools.listDirectory.inProgress', { path: directory_path || 'root' }));

    try {
      // Normalize the path
      const targetPath = directory_path.trim() === "" ? "" : normalizePath(directory_path);
      
      // Get the folder (or root if path is empty)
      const folder = targetPath === "" ? plugin.app.vault.getRoot() : plugin.app.vault.getAbstractFileByPath(targetPath);
      
      if (!folder) {
        context.setLabel(t('tools.listDirectory.failed', { path: targetPath }));
        throw new ToolExecutionError(`Directory not found: ${targetPath}`);
      }
      
      if (!(folder instanceof TFolder)) {
        context.setLabel(t('tools.listDirectory.failed', { path: targetPath }));
        throw new ToolExecutionError(`Path is not a directory: ${targetPath}`);
      }
      
      // Get all children (files and folders)
      const children = folder.children;
      
      if (children.length === 0) {
        const emptyMessage = t('tools.listDirectory.empty', { path: targetPath || 'root' });
        context.setLabel(t('tools.listDirectory.completed', { path: targetPath || 'root' }));
        context.progress(emptyMessage);
        return;
      }
      
      // Sort children: folders first, then files, both alphabetically
      const sortedChildren = children.sort((a, b) => {
        if (a instanceof TFolder && b instanceof TFile) return -1;
        if (a instanceof TFile && b instanceof TFolder) return 1;
        return a.name.localeCompare(b.name);
      });
      
      // Build the result
      const result: string[] = [];
      result.push(t('tools.listDirectory.header', { 
        path: targetPath || 'root',
        count: children.length
      }));
      result.push('');
      
      for (const child of sortedChildren) {
        if (child instanceof TFolder) {
          // It's a folder
          const subItemCount = child.children.length;
          result.push(`📁 **${child.name}/** (${subItemCount} items)`);
        } else if (child instanceof TFile) {
          // It's a file
          const fileSize = (child.stat.size / 1024).toFixed(1);
          result.push(`📄 **${child.name}** (${fileSize} KB)`);
          
          // Add navigation target for each file
          context.addNavigationTarget({
            filePath: child.path,
            description: `Open: ${child.name}`
          });
        }
        result.push('');
      }
      
      const resultText = result.join('\n');
      
      context.setLabel(t('tools.listDirectory.completed', { path: targetPath || 'root' }));
      context.progress(resultText);
    } catch (error) {
      context.setLabel(t('tools.listDirectory.failed', { path: directory_path || 'root' }));
      throw error;
    }
  }
};

// Helper function to count items by type
function countItems(items: DirectoryItem[], type: 'file' | 'folder'): number {
  let count = 0;
  for (const item of items) {
    if (item.type === type) {
      count++;
    }
    if (item.children) {
      count += countItems(item.children, type);
    }
  }
  return count;
} 