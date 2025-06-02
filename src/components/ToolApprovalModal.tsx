import React from 'react';
import { App, Modal, Setting } from 'obsidian';
import { UserDefinedTool } from '../user-tools/types';
import { LucideIcon } from './LucideIcon';
import { t } from '../i18n';

export class ToolApprovalModal extends Modal {
  private tool: UserDefinedTool;
  private onResult: (approved: boolean) => void;

  constructor(app: App, tool: UserDefinedTool, onResult: (approved: boolean) => void) {
    super(app);
    this.tool = tool;
    this.onResult = onResult;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    // Add modal styling
    contentEl.addClass('tool-approval-modal');
    contentEl.style.maxWidth = '600px';
    contentEl.style.maxHeight = '80vh';
    contentEl.style.overflow = 'auto';

    // Header with warning icon
    const headerEl = contentEl.createEl('div', { 
      cls: 'tool-approval-header',
      attr: { style: 'display: flex; align-items: center; gap: 8px; margin-bottom: 16px;' }
    });
    
    const warningIcon = headerEl.createEl('span', {
      attr: { style: 'color: var(--color-red); font-size: 20px;' }
    });
    warningIcon.textContent = '⚠️';
    
    headerEl.createEl('h2', { 
      text: 'Security Warning: User-Defined Tool',
      attr: { style: 'margin: 0; color: var(--color-red);' }
    });

    // Tool information section
    const infoSection = contentEl.createEl('div', { 
      attr: { style: 'margin-bottom: 16px;' }
    });
    
    const toolInfoEl = infoSection.createEl('div', {
      attr: { style: 'background: var(--background-secondary); padding: 12px; border-radius: 6px; margin-bottom: 16px;' }
    });
    
    toolInfoEl.createEl('p').innerHTML = `<strong>Tool:</strong> ${this.escapeHtml(this.tool.name)}`;
    toolInfoEl.createEl('p').innerHTML = `<strong>Description:</strong> ${this.escapeHtml(this.tool.description)}`;
    toolInfoEl.createEl('p').innerHTML = `<strong>File:</strong> ${this.escapeHtml(this.tool.filePath)}`;

    // Security warning section
    const warningSection = contentEl.createEl('div', {
      attr: { 
        style: 'background: var(--background-modifier-error); border: 1px solid var(--color-red); padding: 16px; border-radius: 6px; margin-bottom: 16px;'
      }
    });

    warningSection.createEl('h3', { 
      text: '🔴 IMPORTANT SECURITY NOTICE',
      attr: { style: 'margin: 0 0 8px 0; color: var(--color-red);' }
    });
    
    warningSection.createEl('p', { 
      text: 'This tool will execute JavaScript code that can:',
      attr: { style: 'margin: 8px 0;' }
    });
    
    const risksList = warningSection.createEl('ul', {
      attr: { style: 'margin: 8px 0; padding-left: 20px;' }
    });
    
    risksList.createEl('li', { text: 'Access your entire Obsidian vault' });
    risksList.createEl('li', { text: 'Read, create, modify, or delete files' });
    risksList.createEl('li', { text: 'Make network requests' });
    risksList.createEl('li', { text: 'Potentially access system resources' });
    
    warningSection.createEl('p', { 
      text: 'Only approve tools from trusted sources that you understand!',
      attr: { style: 'font-weight: bold; margin: 8px 0 0 0; color: var(--color-red);' }
    });

    // Tool schema section
    const schemaSection = contentEl.createEl('div', {
      attr: { style: 'margin-bottom: 16px;' }
    });
    
    schemaSection.createEl('h3', { 
      text: 'Tool Schema:',
      attr: { style: 'margin: 0 0 8px 0;' }
    });
    
    const schemaEl = schemaSection.createEl('pre', {
      attr: { 
        style: 'background: var(--background-secondary); padding: 12px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; font-family: var(--font-monospace); font-size: 12px;'
      }
    });
    schemaEl.textContent = JSON.stringify(this.tool.schema, null, 2);

    // Tool code section
    const codeSection = contentEl.createEl('div', {
      attr: { style: 'margin-bottom: 20px;' }
    });
    
    codeSection.createEl('h3', { 
      text: 'Tool Code:',
      attr: { style: 'margin: 0 0 8px 0;' }
    });
    
    const codeEl = codeSection.createEl('pre', {
      attr: { 
        style: 'background: var(--background-secondary); padding: 12px; border-radius: 6px; overflow-x: auto; max-height: 200px; white-space: pre-wrap; font-family: var(--font-monospace); font-size: 12px;'
      }
    });
    codeEl.textContent = this.tool.executeCode;

    // Buttons
    const buttonsEl = contentEl.createEl('div', {
      attr: { 
        style: 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;'
      }
    });

    // Cancel button
    const cancelBtn = buttonsEl.createEl('button', {
      text: 'Cancel',
      attr: { 
        style: 'padding: 8px 16px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); color: var(--text-normal); border-radius: 4px; cursor: pointer;'
      }
    });
    
    cancelBtn.addEventListener('click', () => {
      this.onResult(false);
      this.close();
    });

    // Approve button
    const approveBtn = buttonsEl.createEl('button', {
      text: 'I understand the risks - Approve',
      attr: { 
        style: 'padding: 8px 16px; background: var(--interactive-accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;'
      }
    });
    
    approveBtn.addEventListener('click', () => {
      this.onResult(true);
      this.close();
    });

    // Hover effects
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = 'var(--background-modifier-hover)';
    });
    
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = 'var(--background-primary)';
    });
    
    approveBtn.addEventListener('mouseenter', () => {
      approveBtn.style.opacity = '0.9';
    });
    
    approveBtn.addEventListener('mouseleave', () => {
      approveBtn.style.opacity = '1';
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
} 