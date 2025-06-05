import React from 'react';
import { App, Modal, Setting } from 'obsidian';
import { UserDefinedTool } from '../types/user-tools';
import { LucideIcon } from './LucideIcon';
import { t } from 'src/i18n';

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
    
    // Add modal styling - set up the container structure
    contentEl.addClass('tool-approval-modal');
    contentEl.style.maxWidth = '600px';
    contentEl.style.maxHeight = '80vh';
    contentEl.style.overflow = 'hidden'; // Prevent the whole modal from scrolling
    contentEl.style.display = 'flex';
    contentEl.style.flexDirection = 'column';

    // Fixed Header with warning icon
    const headerEl = contentEl.createEl('div', { 
      cls: 'tool-approval-header',
      attr: { 
        style: 'display: flex; align-items: center; gap: 8px; padding: 16px; border-bottom: 1px solid var(--background-modifier-border); flex-shrink: 0;' 
      }
    });
    
    const warningIcon = headerEl.createEl('span', {
      attr: { style: 'color: var(--color-red); font-size: 20px;' }
    });
    warningIcon.textContent = '⚠️';
    
    headerEl.createEl('h2', { 
      text: t('toolApproval.header.title'),
      attr: { style: 'margin: 0; color: var(--color-red);' }
    });

    // Scrollable content container
    const scrollableContent = contentEl.createEl('div', {
      attr: { 
        style: 'flex: 1; overflow-y: auto; padding: 16px;' 
      }
    });

    // Tool information section
    const toolInfoEl = scrollableContent.createEl('div', {
      attr: { style: 'background: var(--background-secondary); padding: 12px; border-radius: 6px; margin-bottom: 16px;' }
    });
    
    const toolParagraph = toolInfoEl.createEl('p');
    toolParagraph.createEl('strong', { text: t('toolApproval.info.tool') + ':' });
    toolParagraph.appendText(' ' + this.tool.name);
    
    const descParagraph = toolInfoEl.createEl('p');
    descParagraph.createEl('strong', { text: t('toolApproval.info.description') + ':' });
    descParagraph.appendText(' ' + this.tool.description);
    
    const fileParagraph = toolInfoEl.createEl('p');
    fileParagraph.createEl('strong', { text: t('toolApproval.info.file') + ':' });
    fileParagraph.appendText(' ' + this.tool.filePath);

    // Security warning section - fix the red-on-red text issue
    const warningSection = scrollableContent.createEl('div', {
      attr: { 
        style: 'background: var(--background-secondary); border-left: 4px solid var(--color-red); padding: 16px; border-radius: 6px; margin-bottom: 16px; border: 1px solid var(--background-modifier-border);'
      }
    });

    warningSection.createEl('h3', { 
      text: t('toolApproval.security.title'),
      attr: { style: 'margin: 0 0 8px 0; color: var(--color-red);' }
    });
    
    warningSection.createEl('p', { 
      text: t('toolApproval.security.description'),
      attr: { style: 'margin: 8px 0; color: var(--text-normal);' }
    });
    
    const risksList = warningSection.createEl('ul', {
      attr: { style: 'margin: 8px 0; padding-left: 20px; color: var(--text-normal);' }
    });
    
    risksList.createEl('li', { text: t('toolApproval.security.risks.vault') });
    risksList.createEl('li', { text: t('toolApproval.security.risks.files') });
    risksList.createEl('li', { text: t('toolApproval.security.risks.network') });
    risksList.createEl('li', { text: t('toolApproval.security.risks.system') });
    
    warningSection.createEl('p', { 
      text: t('toolApproval.security.warning'),
      attr: { style: 'font-weight: bold; margin: 8px 0 0 0; color: var(--color-red);' }
    });

    // Tool schema section
    const schemaSection = scrollableContent.createEl('div', {
      attr: { style: 'margin-bottom: 16px;' }
    });
    
    schemaSection.createEl('h3', { 
      text: t('toolApproval.schema.title'),
      attr: { style: 'margin: 0 0 8px 0;' }
    });
    
    const schemaEl = schemaSection.createEl('pre', {
      attr: { 
        style: 'background: var(--background-secondary); padding: 12px; border-radius: 6px; white-space: pre-wrap; font-family: var(--font-monospace); font-size: 12px; word-wrap: break-word;'
      }
    });
    schemaEl.textContent = JSON.stringify(this.tool.schema, null, 2);

    // Tool code section - remove individual scrolling
    const codeSection = scrollableContent.createEl('div', {
      attr: { style: 'margin-bottom: 20px;' }
    });
    
    codeSection.createEl('h3', { 
      text: t('toolApproval.code.title'),
      attr: { style: 'margin: 0 0 8px 0;' }
    });
    
    const codeEl = codeSection.createEl('pre', {
      attr: { 
        style: 'background: var(--background-secondary); padding: 12px; border-radius: 6px; white-space: pre-wrap; font-family: var(--font-monospace); font-size: 12px; word-wrap: break-word;'
      }
    });
    codeEl.textContent = this.tool.executeCode;

    // Fixed buttons at the bottom
    const buttonsEl = contentEl.createEl('div', {
      attr: { 
        style: 'display: flex; gap: 10px; justify-content: flex-end; padding: 16px; border-top: 1px solid var(--background-modifier-border); flex-shrink: 0;'
      }
    });

    // Cancel button
    const cancelBtn = buttonsEl.createEl('button', {
      text: t('toolApproval.buttons.cancel'),
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
      text: t('toolApproval.buttons.approve'),
      attr: { 
        style: 'padding: 8px 16px; background: var(--interactive-accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;'
      }
    });
    
    approveBtn.addEventListener('click', () => {
      this.onResult(true);
      this.close();
    });

    // Focus the approve button as the primary action after user has had time to read
    setTimeout(() => {
      approveBtn.focus();
    }, 100);

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
} 