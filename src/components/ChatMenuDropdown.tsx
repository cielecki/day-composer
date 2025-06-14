import React from 'react';
import { UnifiedDropdown, useDropdown, DropdownItem } from './UnifiedDropdown';
import { LucideIcon } from './LucideIcon';
import { t } from 'src/i18n';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { LIFE_NAVIGATOR_VIEW_TYPE } from '../views/chat-view';
import { revealFileInSystem } from 'src/utils/chat/reveal-file-handler';
import { PlatformUtils } from 'src/utils/platform';

interface ChatMenuDropdownProps {
  chatId: string;
  conversationMetaId?: string;
  conversationFilePath?: string;
  onDelete?: () => void;
  onEditTitle?: () => void;
}

export const ChatMenuDropdown: React.FC<ChatMenuDropdownProps> = ({
  chatId,
  conversationMetaId,
  conversationFilePath,
  onDelete,
  onEditTitle
}) => {
  const dropdown = useDropdown();

  const menuItems: DropdownItem[] = [
    {
      id: 'open-new-tab',
      label: t('ui.chat.openInNewTab'),
      icon: 'external-link',
      onClick: async () => {
        try {
          const plugin = LifeNavigatorPlugin.getInstance();
          await plugin.openViewWithStandardBehavior(
            LIFE_NAVIGATOR_VIEW_TYPE,
            { chatId: chatId },
            undefined,
            'tab'
          );
        } catch (error) {
          console.error('Failed to open chat in new tab:', error);
        }
      }
    },
    {
      id: 'edit-title',
      label: t('ui.chat.editTitle'),
      icon: 'edit-2',
      onClick: () => {
        onEditTitle?.();
      }
    },
    {
      id: 'separator-1',
      label: '',
      onClick: () => {},
      type: 'separator'
    },
    {
      id: 'cost-analysis',
      label: t('costAnalysis.menu.viewCosts'),
      icon: 'dollar-sign',
      onClick: async () => {
        try {
          const plugin = LifeNavigatorPlugin.getInstance();
          await plugin.openCostAnalysis(conversationMetaId);
        } catch (error) {
          console.error('Failed to open cost analysis:', error);
        }
      }
    }
  ];

  // Add file-related actions if conversation has a file path
  if (conversationMetaId && conversationFilePath) {
    menuItems.push(
      {
        id: 'reveal-file',
        label: PlatformUtils.getRevealLabel(),
        icon: 'folder-open',
        onClick: async () => {
          try {
            await revealFileInSystem(conversationFilePath);
          } catch (error) {
            console.error('Failed to reveal conversation file:', error);
          }
        }
      },
      {
        id: 'delete-conversation',
        label: t('ui.chat.delete'),
        icon: 'trash-2',
        onClick: () => {
          onDelete?.();
        }
      }
    );
  }

  // Add community/external links
  menuItems.push(
    {
      id: 'separator-2',
      label: '',
      onClick: () => {},
      type: 'separator'
    },
    {
      id: 'github',
      label: t('costAnalysis.menu.githubRepo'),
      icon: 'github',
      onClick: () => {
        window.open('https://github.com/cielecki/life-navigator', '_blank');
      }
    },
    {
      id: 'discord',
      label: t('costAnalysis.menu.discordCommunity'),
      icon: 'message-circle',
      onClick: () => {
        window.open('https://discord.com/invite/VrxZdr3JWH', '_blank');
      }
    },
    {
      id: 'twitter',
      label: t('costAnalysis.menu.authorTwitter'),
      icon: 'user',
      onClick: () => {
        window.open('https://x.com/mcielecki', '_blank');
      }
    }
  );

  const renderTrigger = () => (
    <button
      ref={dropdown.triggerRef as any}
      className="clickable-icon"
      aria-label="More options"
      onClick={dropdown.toggle}
    >
      <LucideIcon name="more-horizontal" size={18} />
    </button>
  );

  return (
    <div className="ln-relative">
      {renderTrigger()}
      
      <UnifiedDropdown
        isOpen={dropdown.isOpen}
        onClose={dropdown.close}
        trigger={renderTrigger()}
        triggerRef={dropdown.triggerRef}
        position="bottom-right"
        minWidth={200}
        items={menuItems}
      />
    </div>
  );
}; 