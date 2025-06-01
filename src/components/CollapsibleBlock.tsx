import React, { useState, useCallback, useRef } from 'react';
import { LucideIcon } from './LucideIcon';
import { getObsidianTools, NavigationTarget } from '../obsidian-tools';
import { t } from '../i18n';
import { ToolInputDisplay } from './ToolInputDisplay';
import { getEditorNavigationService } from '../services/EditorNavigationService';

interface CollapsibleBlockProps {
  summary: React.ReactNode;
  lucideIcon?: string;
  iconColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean; // Allow external control of open state
  onToggle?: (isOpen: boolean) => void; // Callback when state changes
  className?: string;
  dataAttributes?: Record<string, string>;
  onClick?: () => void;
  isClickable?: boolean;
}

/**
 * A reusable collapsible block component for tool usage, thinking, and other expandable content
 */
export const CollapsibleBlock: React.FC<CollapsibleBlockProps> = ({
  summary,
  lucideIcon,
  iconColor,
  children,
  defaultOpen = false,
  isOpen,
  onToggle,
  className = '',
  dataAttributes = {},
  onClick,
  isClickable = false
}) => {
  // Internal state for when no external control is provided
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  
  // Use external state if provided, otherwise use internal state
  const isCurrentlyOpen = isOpen !== undefined ? isOpen : internalOpen;
  
  const handleToggle = useCallback((newOpen: boolean) => {
    if (isOpen === undefined) {
      // Using internal state
      setInternalOpen(newOpen);
    }
    onToggle?.(newOpen);
  }, [isOpen, onToggle]);

  // Convert data attributes to props format for spread operator
  const dataProps: Record<string, string> = {};
  Object.entries(dataAttributes).forEach(([key, value]) => {
    dataProps[`data-${key}`] = value;
  });

  const handleSummaryClick = useCallback((e: React.MouseEvent) => {
    // If we have a click handler and this is clickable, handle the click
    if (onClick && isClickable) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  }, [onClick, isClickable]);

  // Handle native details toggle event
  const handleDetailsToggle = useCallback((e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!isClickable) {
      // Only handle native toggle for non-clickable blocks
      const details = e.currentTarget;
      handleToggle(details.open);
    }
  }, [isClickable, handleToggle]);

  return (
    <details 
      ref={detailsRef}
      className={`collapsible-block ${className} ${isClickable ? 'clickable-tool-block' : ''}`} 
      open={isCurrentlyOpen} 
      onToggle={handleDetailsToggle}
      {...dataProps}
    >
      <summary 
        className={`collapsible-summary ${isClickable ? 'clickable-summary' : ''}`}
        onClick={handleSummaryClick}
      >
        <div className="collapsible-icon-container">
          {/* If we can not click it that means that we will unfold it */}
          {!isClickable && <LucideIcon name="chevron-right" className="collapsible-chevron" size={16} />}
          {/* If we can click it that means that there should be an icon showing on hover as well */}
          {isClickable && lucideIcon && <LucideIcon name={lucideIcon} className="collapsible-chevron" size={16} />}
          {/* Icon is showing as long as we are not hovering over it */}
          {lucideIcon && <LucideIcon name={lucideIcon} className="collapsible-lucide-icon" color={iconColor} size={16} />}
        </div>
        <span className="collapsible-content">
          {summary}
        </span>
      </summary>
      <div className="collapsible-details">
        {children}
      </div>
    </details>
  );
};

// Specialized variant for tool usage
interface ToolBlockProps {
  toolName: string;
  toolInput: any;
  isComplete: boolean;
  result: string;
  defaultOpen?: boolean;
  isError?: boolean;
  navigationTargets?: NavigationTarget[];
}

export const ToolBlock: React.FC<ToolBlockProps> = ({
  toolName,
  toolInput,
  isComplete,
  result,
  defaultOpen = false,
  isError = false,
  navigationTargets = []
}) => {
  const obsidianTools = getObsidianTools(undefined!);
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  // Auto-detect errors from content
  const contentHasErrorIndicator = typeof result === 'string' && result.trim().startsWith('❌');
  const effectiveIsError = isError || contentHasErrorIndicator;
  
  const tool = obsidianTools.getToolByName(toolName);
  const actionText = tool?.getActionText(
    toolInput, 
    false,
    isComplete,
    effectiveIsError
  );
  const iconName = tool?.icon;
  
  // Use the passed navigation targets
  const isClickable = navigationTargets.length > 0;
  
  const handleToolClick = useCallback(async () => {
    if (!isClickable || navigationTargets.length === 0) return;
    
    try {
      // Get the current target
      const target = navigationTargets[currentTargetIndex];
      
      // Close the block if it's currently open
      if (isOpen) {
        setIsOpen(false);
      }
      
      // Navigate to the target
      const navigationService = getEditorNavigationService(window.app);
      await navigationService.navigateToTarget(target);
      
      // Cycle to next target if there are multiple
      if (navigationTargets.length > 1) {
        setCurrentTargetIndex((prev) => (prev + 1) % navigationTargets.length);
      }
    } catch (error) {
      console.error('Error navigating to target:', error);
    }
  }, [isClickable, navigationTargets, currentTargetIndex, isOpen]);
  
  // Build summary with target indicator
  const summary = (
    <span className="tool-action-text">
      {actionText}
    </span>
  );

  return (
    <CollapsibleBlock
      summary={summary}
      lucideIcon={effectiveIsError ? "alert-circle" : iconName}
      iconColor={effectiveIsError ? "var(--color-red)" : "var(--color-blue)"}
      className={`${!isComplete ? "pulsing" : ""} ${effectiveIsError ? "tool-error" : ""}`}
      isOpen={isOpen}
      onToggle={setIsOpen}
      onClick={handleToolClick}
      isClickable={isClickable}
      dataAttributes={{ 
        tool: toolName,
        'has-result': isComplete.toString(),
        'has-error': effectiveIsError.toString(),
        'is-clickable': isClickable.toString()
      }}
    >
      <div className="tool-input-params">
        <ToolInputDisplay toolName={toolName} toolInput={toolInput} />
      </div>
      
      <div className={`tool-result-content ${effectiveIsError ? "tool-result-error" : ""}`}>
        {result}
      </div>
    </CollapsibleBlock>
  );
};

// Specialized variant for thinking blocks
interface ThinkingBlockProps {
  thinking: string;
  defaultOpen?: boolean;
  reasoningInProgress?: boolean; // Add flag to indicate if reasoning is still being generated
}

export const ThinkingCollapsibleBlock: React.FC<ThinkingBlockProps> = ({
  thinking,
  defaultOpen = false,
  reasoningInProgress = false
}) => {
  return (
    <CollapsibleBlock
      summary={
        <span>
          {reasoningInProgress ? t('ui.thinking.inProgress') : t('ui.thinking.completed')}
        </span>
      }
      lucideIcon="brain"
      iconColor="var(--color-yellow)"
      className={`${reasoningInProgress ? "pulsing" : ""}`}
      defaultOpen={defaultOpen}
    >
      <div className="thinking-content">{thinking}</div>
    </CollapsibleBlock>
  );
};

// Redacted thinking component
export const RedactedThinkingBlock: React.FC = () => {
  return (
    <div className="redacted-thinking-block">
      <LucideIcon name="lock" className="redacted-icon" color="var(--color-red)" />
      <span>{t('ui.thinking.redacted')}</span>
    </div>
  );
}; 