import { TFile, TFolder } from "obsidian";
import MyPlugin from "../main";
import { ObsidianTool } from "../obsidian-tools";
import { ToolExecutionContext } from "../utils/chat/types";
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
  getActionText: (input: ListDirectoryToolInput, hasStarted: boolean, hasCompleted: boolean, hasError: boolean) => {
    const path = input?.directory_path || "vault root";
    const recursive = input?.recursive ? " (recursive)" : "";
    
    if (hasError) {
      return `Failed to list directory: ${path}`;
    } else if (hasCompleted) {
      return `Listed directory: ${path}${recursive}`;
    } else if (hasStarted) {
      return `Listing directory: ${path}${recursive}...`;
    } else {
      return `List directory: ${path}${recursive}`;
    }
  },
  execute: async (context: ToolExecutionContext<ListDirectoryToolInput>): Promise<void> => {
    try {
      const { plugin, params } = context;
      const { 
        directory_path = "", 
        recursive = false, 
        include_files = true, 
        include_folders = true,
        file_types = []
      } = params;

      context.progress("Preparing directory listing...");

      // Normalize the directory path
      const targetPath = directory_path?.trim() || "";
      const normalizedPath = targetPath === "." || targetPath === "" ? "" : targetPath;

      // Get the target folder
      let targetFolder: TFolder;
      if (normalizedPath === "") {
        // Root of vault
        targetFolder = plugin.app.vault.getRoot();
      } else {
        const abstractFile = plugin.app.vault.getAbstractFileByPath(normalizedPath);
        if (!abstractFile) {
          throw new Error(`Directory not found: ${normalizedPath}`);
        }
        if (!(abstractFile instanceof TFolder)) {
          throw new Error(`Path is not a directory: ${normalizedPath}`);
        }
        targetFolder = abstractFile;
      }

      context.progress(`Scanning directory: ${targetFolder.path || "vault root"}...`);

      // Build the directory listing
      const listDirectory = (folder: TFolder, currentDepth: number = 0): DirectoryItem[] => {
        const items: DirectoryItem[] = [];
        
        // Process folders first
        if (include_folders) {
          for (const childFolder of folder.children.filter(child => child instanceof TFolder)) {
            const folderItem: DirectoryItem = {
              name: childFolder.name,
              path: childFolder.path,
              type: 'folder'
            };
            
            // Add children if recursive
            if (recursive) {
              folderItem.children = listDirectory(childFolder as TFolder, currentDepth + 1);
            }
            
            items.push(folderItem);
          }
        }

        // Process files
        if (include_files) {
          for (const childFile of folder.children.filter(child => child instanceof TFile)) {
            const file = childFile as TFile;
            
            // Filter by file types if specified
            if (file_types.length > 0 && !file_types.includes(file.extension)) {
              continue;
            }

            const fileItem: DirectoryItem = {
              name: file.name,
              path: file.path,
              type: 'file',
              extension: file.extension,
              size: file.stat.size
            };
            
            items.push(fileItem);
          }
        }

        return items;
      };

      const results = listDirectory(targetFolder);

      // Format the results
      const formatResults = (items: DirectoryItem[], depth: number = 0): string => {
        let output = "";
        const indent = "  ".repeat(depth);
        
        for (const item of items) {
          if (item.type === 'folder') {
            output += `${indent}📁 ${item.name}/\n`;
            if (item.children && recursive) {
              output += formatResults(item.children, depth + 1);
            }
          } else {
            const sizeStr = item.size ? ` (${(item.size / 1024).toFixed(1)}KB)` : "";
            const icon = item.extension === 'md' ? '📝' : '📄';
            output += `${indent}${icon} ${item.name}${sizeStr}\n`;
          }
        }
        
        return output;
      };

      const formattedResults = formatResults(results);
      const totalFiles = countItems(results, 'file');
      const totalFolders = countItems(results, 'folder');

      // Create summary
      const pathDisplay = targetFolder.path || "vault root";
      const recursiveNote = recursive ? " (recursive)" : "";
      const summary = `Directory listing for: ${pathDisplay}${recursiveNote}\n\n` +
                     `📊 Summary: ${totalFolders} folders, ${totalFiles} files\n\n` +
                     formattedResults;

      context.progress(summary);

    } catch (error) {
      console.error('Error listing directory:', error);
      throw new Error(`Error listing directory: ${error.message || 'Unknown error'}`);
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