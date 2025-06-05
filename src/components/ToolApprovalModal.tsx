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
    contentEl.addClass('ln-modal-container');

    // Fixed Header with warning icon
    const headerEl = contentEl.createEl('div', { 
      cls: 'tool-approval-header ln-modal-header'
    });
    
    const warningIcon = headerEl.createEl('span', {
      attr: { style: 'color: var(--color-red); font-size: 20px;' }
    });
    warningIcon.textContent = '⚠️';
    
    headerEl.createEl('h2', { 
      text: t('toolApproval.header.title'),
      cls: 'ln-m-0',
      attr: { style: 'color: var(--color-red);' }
    });

    // Scrollable content container
    const scrollableContent = contentEl.createEl('div', {
      cls: 'ln-modal-scrollable'
    });

    // Tool information section
    const toolInfoEl = scrollableContent.createEl('div', {
      cls: 'ln-modal-info-section'
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
      cls: 'ln-modal-warning-section'
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
      cls: 'ln-font-bold',
      attr: { style: 'margin: 8px 0 0 0; color: var(--color-red);' }
    });

    // Tool schema section
    const schemaSection = scrollableContent.createEl('div', {
      cls: 'ln-mb-4'
    });
    
    schemaSection.createEl('h3', { 
      text: t('toolApproval.schema.title'),
      cls: 'ln-m-0',
      attr: { style: 'margin-bottom: 8px;' }
    });
    
    const schemaEl = schemaSection.createEl('pre', {
      cls: 'ln-modal-code-block'
    });
    schemaEl.textContent = JSON.stringify(this.tool.schema, null, 2);

    // Tool code section - remove individual scrolling
    const codeSection = scrollableContent.createEl('div', {
      attr: { style: 'margin-bottom: 20px;' }
    });
    
    codeSection.createEl('h3', { 
      text: t('toolApproval.code.title'),
      cls: 'ln-m-0',
      attr: { style: 'margin-bottom: 8px;' }
    });
    
    const codeEl = codeSection.createEl('pre', {
      cls: 'ln-modal-code-block'
    });
    codeEl.textContent = this.tool.executeCode;

    // Fixed buttons at the bottom
    const buttonsEl = contentEl.createEl('div', {
      cls: 'ln-modal-buttons'
    });

    // Cancel button
    const cancelBtn = buttonsEl.createEl('button', {
      text: t('toolApproval.buttons.cancel'),
      cls: 'ln-modal-button cancel'
    });
    
    cancelBtn.addEventListener('click', () => {
      this.onResult(false);
      this.close();
    });

    // Approve button
    const approveBtn = buttonsEl.createEl('button', {
      text: t('toolApproval.buttons.approve'),
      cls: 'ln-modal-button approve'
    });
    
    approveBtn.addEventListener('click', () => {
      this.onResult(true);
      this.close();
    });

    // Focus the approve button as the primary action after user has had time to read
    setTimeout(() => {
      approveBtn.focus();
    }, 100);

    // Hover effects are now handled by CSS classes
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
} 