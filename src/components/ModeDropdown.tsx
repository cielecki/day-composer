import React, { useCallback } from 'react';
import { UnifiedDropdown, useDropdown, DropdownSection } from './UnifiedDropdown';
import { useSearch } from '../hooks/useSearch';
import { LucideIcon } from './LucideIcon';
import { TFile } from "obsidian";
import { t } from 'src/i18n';
import { usePluginStore } from '../store/plugin-store';
import { LifeNavigatorPlugin } from '../LifeNavigatorPlugin';
import { DEFAULT_MODE_ID } from '../utils/modes/ln-mode-defaults';

interface ModeDropdownProps {
  chatId?: string;
  chatActiveModeId: string;
  activeMode: any;
  isModeLoading: boolean;
  isModesLoading: boolean;
  availableModes: Record<string, any>;
  onModeSelect: (modeId: string) => void;
}

export const ModeDropdown: React.FC<ModeDropdownProps> = ({
  chatId,
  chatActiveModeId,
  activeMode,
  isModeLoading,
  isModesLoading,
  availableModes,
  onModeSelect
}) => {
  const dropdown = useDropdown();
  
  // Convert availableModes object to array for search hook
  const modesArray = Object.values(availableModes);
  
  // Use unified search hook
  const search = useSearch(
    modesArray,
    (mode: any) => [
      mode.name || '',
      mode.description || ''
    ]
  );

  // Convert filtered array back to object format for compatibility
  const filteredModes = Object.fromEntries(
    search.filteredItems.map((mode: any) => [mode.path, mode])
  );

  // Create sections for the dropdown using filtered modes
  const sections: DropdownSection[] = [];

  // Actions section (only if activeMode is loaded and no search query)
  if (activeMode && !search.hasQuery) {
    const actionItems = [];

    // Open in editor action (only for non-prebuilt modes)
    if (!activeMode.path.startsWith(':prebuilt:')) {
      actionItems.push({
        id: 'open-editor',
        label: t('ui.mode.openInEditor'),
        icon: 'external-link',
        onClick: () => {
          if (window.app && activeMode.path) {
            const file = window.app.vault.getAbstractFileByPath(activeMode.path);
            if (file instanceof TFile) {
              window.app.workspace.getLeaf().openFile(file);
            }
          }
        },
        type: 'action' as const
      });
    }

    // View system prompt action
    actionItems.push({
      id: 'view-prompt',
      label: t('ui.mode.viewSystemPrompt'),
      icon: 'terminal',
      onClick: async () => {
        const plugin = LifeNavigatorPlugin.getInstance();
        if (plugin && chatActiveModeId) {
          await plugin.openSystemPrompt(chatActiveModeId);
        }
      },
      type: 'action' as const
    });

    if (actionItems.length > 0) {
      // Add separator
      actionItems.push({
        id: 'separator-1',
        label: '',
        onClick: () => {},
        type: 'separator' as const
      });

      sections.push({
        items: actionItems
      });
    }
  }

  // Modes section using filtered modes
  const modeItems = Object.values(filteredModes).map((mode: any, index) => ({
    id: `mode-${index}`,
    label: mode.name,
    icon: mode.icon,
    iconColor: mode.icon_color || "var(--text-normal)",
    onClick: () => {
      console.debug('ModeDropdown: Mode clicked:', mode.path, mode.name);
      onModeSelect(mode.path);
      dropdown.close(); // Close dropdown after selection
    },
    type: 'item' as const,
    className: mode.path === activeMode?.path ? 'active' : ''
  }));

  if (modeItems.length > 0) {
    sections.push({
      label: t('ui.mode.switchTo'),
      items: modeItems
    });
  }

  const renderTrigger = () => (
    <div
      className={`ln-mode-indicator ${dropdown.isOpen ? 'open' : ''}`}
      onClick={dropdown.toggle}
      ref={dropdown.triggerRef as any}
      role="button"
      tabIndex={0}
    >
      {isModeLoading ? (
        <>
          <span className="ln-icon-center">
            <LucideIcon
              name={isModesLoading ? "loader-2" : "clock"}
              size={16}
              color="var(--text-muted)"
              className={isModesLoading ? "animate-spin" : ""}
            />
          </span>
          <span className="ln-mode-name">
            {t('ui.mode.loading')}
          </span>
        </>
      ) : activeMode ? (
        <>
          <span className="ln-icon-center">
            <LucideIcon
              name={activeMode.icon}
              size={16}
              color={activeMode.icon_color || "var(--text-normal)"}
            />
          </span>
          <span className="ln-mode-name">
            {activeMode.name}
          </span>
        </>
      ) : (
        <>
          <span className="ln-icon-center">
            <LucideIcon
              name="help-circle"
              size={16}
              color="var(--text-muted)"
            />
          </span>
          <span className="ln-mode-name">
            Select mode
          </span>
        </>
      )}
      <span className={`ln-chevron ${dropdown.isOpen ? 'open' : ''}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </span>
    </div>
  );

  return (
    <div className="ln-relative ln-inline-block">
      {renderTrigger()}
      
      <UnifiedDropdown
        isOpen={dropdown.isOpen}
        onClose={dropdown.close}
        trigger={renderTrigger()}
        triggerRef={dropdown.triggerRef}
        position="top-left"
        minWidth={200}
        maxWidth={300}
        maxHeight={400}
        sections={sections}
        searchable={true}
        searchPlaceholder={t('ui.mode.searchModes')}
        searchPosition="bottom"
        onSearch={search.handleSearch}
        emptyText={t('ui.mode.noModesFound')}
        dropdownClassName="ln-mode-dropdown-legacy"
      />
    </div>
  );
}; 