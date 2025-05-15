import React from 'react';
import { LucideIcon } from './LucideIcon';
import { getObsidianTools } from '../obsidian-tools';
import { t } from '../i18n';

interface CollapsibleBlockProps {
  summary: React.ReactNode;
  lucideIcon?: string;
  iconColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  dataAttributes?: Record<string, string>;
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
  className = '',
  dataAttributes = {}
}) => {
  // Convert data attributes to props format for spread operator
  const dataProps: Record<string, string> = {};
  Object.entries(dataAttributes).forEach(([key, value]) => {
    dataProps[`data-${key}`] = value;
  });

  return (
    <details className={`collapsible-block ${className}`} open={defaultOpen} {...dataProps}>
      <summary className="collapsible-summary">
        {lucideIcon && <LucideIcon name={lucideIcon} className="collapsible-lucide-icon" color={iconColor} />}
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
  hasResult: boolean;
  result?: string;
  defaultOpen?: boolean;
  isError?: boolean;
}

export const ToolBlock: React.FC<ToolBlockProps> = ({
  toolName,
  toolInput,
  hasResult,
  result,
  defaultOpen = false,
  isError = false
}) => {
  const obsidianTools = getObsidianTools(undefined!);
  
  // Auto-detect errors from content
  const contentHasErrorIndicator = typeof result === 'string' && result.trim().startsWith('❌');
  const effectiveIsError = isError || contentHasErrorIndicator;
  
  const actionText = obsidianTools.getToolByName(toolName)?.getActionText(
    toolInput, 
    hasResult && result ? result : '',
    hasResult,
    effectiveIsError
  );
  const iconName = obsidianTools.getToolByName(toolName)?.icon;
  
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
      className={`tool-use-block ${!hasResult ? "pulsing" : ""} ${effectiveIsError ? "tool-error" : ""}`}
      defaultOpen={defaultOpen}
      dataAttributes={{ 
        tool: toolName,
        'has-result': hasResult.toString(),
        'has-error': effectiveIsError.toString()
      }}
    >
      <div className="tool-input-params">
        <pre className="tool-input-content"><code>{JSON.stringify(toolInput, null, 2)}</code></pre>
      </div>
      
      {!hasResult ? (
        <div className="tool-in-progress">
          <div className="thinking-indicator">
            <div className="thinking-dot"></div>
            <div className="thinking-dot"></div>
            <div className="thinking-dot"></div>
          </div>
        </div>
      ) : (
        <div className={`tool-result-content ${effectiveIsError ? "tool-result-error" : ""}`}>
          <pre className="tool-use-result"><code>{result}</code></pre>
        </div>
      )}
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
      className={`thinking-block ${reasoningInProgress ? "pulsing" : ""}`}
      defaultOpen={defaultOpen}
    >
      <pre className="thinking-content"><code>{thinking}</code></pre>
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