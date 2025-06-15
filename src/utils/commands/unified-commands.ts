import { t } from 'src/i18n';

export interface UnifiedCommandConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  showInChatDropdown: boolean;
  showInSettings: boolean;
  category?: 'life-navigator' | 'community' | 'chat';
}

/**
 * Get all unified commands configuration
 * This is the single source of truth for commands that appear in both
 * chat dropdown and settings
 */
export function getUnifiedCommands(): UnifiedCommandConfig[] {
  return [
    {
      id: 'life-navigator:check-for-updates',
      name: t('commands.checkUpdates.name'),
      description: t('commands.checkUpdates.desc'),
      icon: 'download',
      showInChatDropdown: true,
      showInSettings: true,
      category: 'life-navigator'
    },
    {
      id: 'life-navigator:reset-tutorial',
      name: t('commands.resetTutorial.name'),
      description: t('commands.resetTutorial.desc'),
      icon: 'refresh-cw',
      showInChatDropdown: false, // Excluded from chat dropdown as requested
      showInSettings: true,
      category: 'life-navigator'
    },
    {
      id: 'life-navigator:show-whats-new',
      name: t('commands.whatsNew.name'),
      description: t('commands.whatsNew.desc'),
      icon: 'sparkles',
      showInChatDropdown: true,
      showInSettings: true,
      category: 'life-navigator'
    },
    {
      id: 'life-navigator:open-github',
      name: t('commands.github.name'),
      description: t('commands.github.desc'),
      icon: 'github',
      showInChatDropdown: true,
      showInSettings: true,
      category: 'community'
    },
    {
      id: 'life-navigator:open-discord',
      name: t('commands.discord.name'),
      description: t('commands.discord.desc'),
      icon: 'message-circle',
      showInChatDropdown: true,
      showInSettings: true,
      category: 'community'
    },
    {
      id: 'life-navigator:open-twitter',
      name: t('commands.twitter.name'),
      description: t('commands.twitter.desc'),
      icon: 'user',
      showInChatDropdown: true,
      showInSettings: true,
      category: 'community'
    }
  ];
}

/**
 * Get commands for chat dropdown
 */
export function getChatDropdownCommands(): UnifiedCommandConfig[] {
  return getUnifiedCommands().filter(cmd => cmd.showInChatDropdown);
}

/**
 * Get commands for settings
 */
export function getSettingsCommands(): UnifiedCommandConfig[] {
  return getUnifiedCommands().filter(cmd => cmd.showInSettings);
} 