import { UserDefinedTool, ToolApproval } from './types';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { ToolApprovalModal } from '../components/ToolApprovalModal';

export class UserToolApprovalManager {
  private plugin: LifeNavigatorPlugin;
  private approvals: Map<string, ToolApproval> = new Map();
  private storageKey = 'user-tool-approvals';

  constructor(plugin: LifeNavigatorPlugin) {
    this.plugin = plugin;
    this.loadApprovals();
  }

  async requestApproval(tool: UserDefinedTool): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new ToolApprovalModal(this.plugin.app, tool, (approved) => {
        if (approved) {
          this.addApproval(tool);
        }
        resolve(approved);
      });
      modal.open();
    });
  }

  isApproved(toolPath: string, codeHash: string, schemaHash: string): boolean {
    const approval = this.approvals.get(toolPath);
    return !!(approval && approval.codeHash === codeHash && approval.schemaHash === schemaHash);
  }

  private addApproval(tool: UserDefinedTool): void {
    const approval: ToolApproval = {
      toolPath: tool.filePath,
      codeHash: tool.codeHash,
      schemaHash: tool.schemaHash,
      approvedAt: Date.now(),
      approvedByUser: true
    };

    this.approvals.set(tool.filePath, approval);
    this.saveApprovals();
  }

  private async loadApprovals(): Promise<void> {
    try {
      const data = await this.plugin.loadData();
      const approvalData = data?.[this.storageKey] || {};
      
      this.approvals.clear();
      for (const [path, approval] of Object.entries(approvalData)) {
        this.approvals.set(path, approval as ToolApproval);
      }
    } catch (error) {
      console.warn('Failed to load tool approvals:', error);
    }
  }

  private async saveApprovals(): Promise<void> {
    try {
      const data = await this.plugin.loadData() || {};
      const approvalData: Record<string, ToolApproval> = {};
      
      for (const [path, approval] of this.approvals) {
        approvalData[path] = approval;
      }
      
      data[this.storageKey] = approvalData;
      await this.plugin.saveData(data);
    } catch (error) {
      console.error('Failed to save tool approvals:', error);
    }
  }

  revokeApproval(toolPath: string): void {
    this.approvals.delete(toolPath);
    this.saveApprovals();
  }

  getApprovals(): ToolApproval[] {
    return Array.from(this.approvals.values());
  }

  getApproval(toolPath: string): ToolApproval | undefined {
    return this.approvals.get(toolPath);
  }
} 