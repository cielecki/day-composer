import React from 'react';
import { App, Modal } from 'obsidian';
import * as ReactDOM from 'react-dom/client';
import { WhatsNewModal } from './WhatsNewModal';
import { t } from 'src/i18n';

export class WhatsNewModalWrapper extends Modal {
  private reactRoot: ReactDOM.Root | null = null;
  private onCloseCallback?: () => void;
  private currentVersion: string;

  constructor(app: App, onCloseCallback?: () => void) {
    super(app);

    this.setTitle(t('whatsNew.title'));
    this.onCloseCallback = onCloseCallback;
    // @ts-ignore - plugins property exists on app
    this.currentVersion = this.app.plugins.plugins['life-navigator']?.manifest?.version || '0.11.3';
  }


  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    // Create React root
    this.reactRoot = ReactDOM.createRoot(contentEl);
    
    // Render the React component
    this.reactRoot.render(
      <WhatsNewModal 
        onClose={this.handleClose.bind(this)}
        currentVersion={this.currentVersion}
      />
    );
  }

  private handleClose() {
    this.close();
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  onClose() {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }
} 