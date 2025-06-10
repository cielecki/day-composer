import { LifeNavigatorPlugin } from 'src/LifeNavigatorPlugin';
import { UserDefinedTool } from 'src/types/user-tools';
import { UserDefinedToolScanner } from './UserDefinedToolScanner';
import { UserToolApprovalManager } from './ToolApprovalManager';
import { SecureExecutionContext } from '../types/SecureExecutionContext';
import { ObsidianTool } from '../obsidian-tools';
import { ToolExecutionContext } from 'src/types/tool-execution-context';
import { ToolExecutionError } from 'src/types/tool-execution-error';
import { getObsidianTools } from '../obsidian-tools';
import { sanitizeToolName } from 'src/utils/text/string-sanitizer';
import { validateToolFile } from '../utils/validation/tool-validation';
import { getStore } from '../store/plugin-store';
import { TFile } from 'obsidian';
import { FileWatcher } from '../utils/fs/file-watcher';

export class UserDefinedToolManager {
  private plugin: LifeNavigatorPlugin;
  private tools: Map<string, UserDefinedTool> = new Map();
  private approvalManager: UserToolApprovalManager;
  private scanner: UserDefinedToolScanner;
  private secureContext: SecureExecutionContext;
  private fileWatcher: FileWatcher | null = null;

  constructor(plugin: LifeNavigatorPlugin) {
    this.plugin = plugin;
    this.approvalManager = new UserToolApprovalManager(plugin);
    this.scanner = new UserDefinedToolScanner(plugin.app);
    this.secureContext = new SecureExecutionContext();
  }

  async initialize(): Promise<void> {
    // Initial scan for tools
    await this.refreshTools();

    // Create and start file watcher for tools
    this.fileWatcher = new FileWatcher({
      tag: 'ln-tool',
      reloadFunction: () => this.refreshTools(),
      debounceDelay: 2000,
      debugPrefix: 'USER-TOOLS'
    });

    this.fileWatcher.start();

    // Update tracked paths with current tool file paths
    const toolFilePaths = Array.from(this.tools.values()).map(tool => tool.filePath);
    this.fileWatcher.updateTrackedPaths(toolFilePaths);
  }

  async refreshTools(): Promise<void> {
    try {
      const discoveredTools = await this.scanner.scanForTools();
      const invalidTools: string[] = [];
      
      // Validate each tool and track invalid ones
      for (const tool of discoveredTools) {
        try {
          // Get the file for validation
          const file = this.plugin.app.vault.getAbstractFileByPath(tool.filePath);
          if (file instanceof TFile) {
            // Get metadata and content for validation
            const metadata = this.plugin.app.metadataCache.getFileCache(file);
            const content = await this.plugin.app.vault.read(file);
            
            // Validate the tool file
            const validation = await validateToolFile(this.plugin.app, file, metadata, content);
            
            if (!validation.isValid) {
              invalidTools.push(tool.filePath);
            }
          }
        } catch (error) {
          console.warn(`[USER-TOOLS] Failed to validate tool ${tool.name}:`, error);
          invalidTools.push(tool.filePath);
        }
      }
      
      // Update tool registry
      this.tools.clear();
      for (const tool of discoveredTools) {
        this.tools.set(tool.name, tool);
      }

      // Update validation state in store
      const store = getStore();
      store.setInvalidTools(invalidTools);
      
      if (invalidTools.length > 0) {
        console.warn(`[USER-TOOLS] Found ${invalidTools.length} invalid tools:`, invalidTools);
      }

      // Update obsidian tools registry
      this.updateObsidianToolsRegistry();
      
      // Update file watcher with current tool file paths
      if (this.fileWatcher) {
        const toolFilePaths = Array.from(this.tools.values()).map(tool => tool.filePath);
        this.fileWatcher.updateTrackedPaths(toolFilePaths);
      }
      
    } catch (error) {
      console.error('[USER-TOOLS] Failed to refresh tools:', error);
    }
  }

  private updateObsidianToolsRegistry(): void {
    const obsidianTools = getObsidianTools();
    
    // Get current tools and remove old user-defined tools
    // Note: We can't use async here, so we access the tools array directly
    // This is a temporary workaround until the full async refactor
    const currentTools = (obsidianTools as any).tools || [];
    const filteredTools = currentTools.filter((tool: any) => 
      !tool.specification.name.startsWith('user_')
    );

    // Add all user-defined tools (no enabled/disabled filtering)
    for (const [name, tool] of this.tools) {
      try {
        const obsidianTool: ObsidianTool<any> = {
          specification: this.generateToolSpecification(tool),
          icon: tool.icon,
          sideEffects: tool.sideEffects !== false, // Default to true for user tools unless explicitly marked as safe
          initialLabel: tool.name,
          execute: async (context: ToolExecutionContext) => {
            await this.executeUserDefinedTool(tool, context);
          }
        };
        filteredTools.push(obsidianTool);
      } catch (error) {
        console.warn(`[USER-TOOLS] Failed to register tool ${name}:`, error);
      }
    }

    // Update the tools array (this is a hack - ideally we'd have a proper registration API)
    (obsidianTools as any).tools = filteredTools;
  }

  private generateToolSpecification(tool: UserDefinedTool): any {
    // Use the schema from the tool, or create a basic one
    const schema = tool.schema || {
      type: "object",
      properties: {},
      required: []
    };
    
    return {
      name: `user_${sanitizeToolName(tool.name)}`,
      description: tool.description || `User-defined tool: ${tool.name}`,
      input_schema: schema
    };
  }

  private async executeUserDefinedTool(
    tool: UserDefinedTool, 
    context: ToolExecutionContext
  ): Promise<void> {
    // Check if tool is approved
    if (!this.approvalManager.isApproved(tool.filePath, tool.codeHash, tool.schemaHash)) {
      const approved = await this.approvalManager.requestApproval(tool);
      if (!approved) {
        throw new ToolExecutionError('Tool execution not approved by user');
      }
    }

    // Create user tool context
    const userContext = {
      params: context.params,
      plugin: context.plugin,
      progress: context.progress,
      addNavigationTarget: context.addNavigationTarget,
      setLabel: (text: string) => {
        context.setLabel(text);
      }
    };

    // Execute in secure context
    await this.secureContext.executeUserCode(tool.executeCode, userContext);
  }

  getTools(): UserDefinedTool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): UserDefinedTool | undefined {
    return this.tools.get(name);
  }

  // New methods for settings UI support
  getToolStatus(tool: UserDefinedTool): {
    approved: boolean;
    codeChanged: boolean;
    lastApproved?: number;
  } {
    const approval = this.approvalManager.getApproval(tool.filePath);
    const approved = this.approvalManager.isApproved(tool.filePath, tool.codeHash, tool.schemaHash);
    const codeChanged = approval && (approval.codeHash !== tool.codeHash || approval.schemaHash !== tool.schemaHash);

    return {
      approved,
      codeChanged: !!codeChanged,
      lastApproved: approval?.approvedAt
    };
  }

  async approveToolFromSettings(toolPath: string): Promise<boolean> {
    const tool = Array.from(this.tools.values()).find(t => t.filePath === toolPath);
    if (!tool) {
      throw new Error(`Tool not found: ${toolPath}`);
    }

    const approved = await this.approvalManager.requestApproval(tool);
    return approved;
  }

  revokeToolApproval(toolPath: string): void {
    this.approvalManager.revokeApproval(toolPath);
    // Refresh tools to update the registry
    this.updateObsidianToolsRegistry();
  }

  /**
   * Clean up resources when the plugin is unloaded
   */
  cleanup(): void {
    if (this.fileWatcher) {
      this.fileWatcher.stop();
      this.fileWatcher = null;
    }
    this.tools.clear();
    console.debug('[USER-TOOLS] UserDefinedToolManager cleanup completed');
  }
} 