import { t } from 'i18next';
import { Platform } from 'obsidian';

/**
 * Platform detection utility for providing context-aware UI labels
 */
export class PlatformUtils {
  /**
   * Get the appropriate translation key for "reveal in file manager" 
   */
  static getRevealLabel(): string {
    if (Platform.isMacOS) {
      return t('ui.chat.revealInFinder');
    } else if (Platform.isWin) {
      return t('ui.chat.revealInExplorer');
    } else if (Platform.isMobileApp) {
      if (Platform.isIosApp) {
        return t('ui.chat.revealInFiles');
      } else {
        return t('ui.chat.revealInFileManager');
      }
    } else {
      // Linux and other desktop platforms
      return t('ui.chat.revealInFileManager');
    }
  }

  /**
   * Check if the current platform supports file revelation
   */
  static supportsFileRevelation(): boolean {
    // Mobile platforms may not support file revelation
    return !Platform.isMobileApp;
  }
} 