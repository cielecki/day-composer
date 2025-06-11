import { Notice, App } from 'obsidian';
import { t } from 'src/i18n';
import { PlatformUtils } from '../platform';

declare global {
  interface Window {
    app: App & {
      showInFolder: (filePath: string) => void;
    };
  }
}

/**
 * Reveals a file in the system explorer (Finder on macOS, File Explorer on Windows, etc.)
 * @param filePath - The full path to the file to reveal
 * @returns Promise<boolean> - Whether the reveal was successful
 */
export async function revealFileInSystem(filePath: string): Promise<boolean> {
  try {
    // Use Obsidian's built-in showInFolder method
    if (window.app && typeof window.app.showInFolder === 'function') {
      window.app.showInFolder(filePath);
      return true;
    } else {
      console.error('Obsidian showInFolder API not available');
      new Notice(t('ui.chat.revealFailed'));
      return false;
    }
  } catch (error) {
    console.error('Failed to reveal file in system explorer:', error);
    new Notice(t('ui.chat.revealFailed'));
    return false;
  }
} 