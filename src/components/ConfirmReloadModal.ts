import { App, Modal, Setting } from 'obsidian';
import { t } from 'src/i18n';

export class ConfirmReloadModal extends Modal {
  constructor(app: App, private onConfirm: () => void, private currentVersion: string, private latestVersion: string) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: t('ui.modal.reloadRequiredTitle') });
    const message = t('ui.modal.reloadRequiredMessageWithVersions', { currentVersion: this.currentVersion, latestVersion: this.latestVersion });
    message.split('\n').forEach(line => {
      contentEl.createEl('p', { text: line });
    });

    new Setting(contentEl)
      .addButton(button => button
        .setButtonText(t('ui.modal.reloadButton'))
        .setCta()
        .onClick(() => {
          this.onConfirm();
          this.close();
        }))
      .addButton(button => button
        .setButtonText(t('buttons.cancel'))
        .onClick(() => {
          this.close();
        }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
} 