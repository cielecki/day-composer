import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Notice } from "obsidian";
import { t } from 'src/i18n';
import { usePluginStore } from "../store/plugin-store";
import { SystemPromptParts } from '../utils/links/expand-links';
import { LucideIcon } from "./LucideIcon";
import { LNMode } from "src/types/mode";

interface SystemPromptAppProps {
  onTitleChange?: () => void;
  modeId: string;
}

export const SystemPromptApp: React.FC<SystemPromptAppProps> = ({ onTitleChange, modeId }) => {
  const [systemPrompt, setSystemPrompt] = useState<SystemPromptParts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Use stable selectors to prevent unnecessary re-renders
  const availableModes = usePluginStore(state => state.modes.available);
  
  // Memoize targetMode to prevent object recreation on every render
  const targetMode = useMemo(() => {
    return availableModes[modeId] as LNMode | undefined;
  }, [availableModes, modeId]);

  // Stable function for loading system prompt
  const loadSystemPrompt = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!targetMode) {
      return;
    }
    
    try {
      const prompt = await usePluginStore.getState().getSystemPrompt(targetMode.path);
      setSystemPrompt(prompt);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('Error loading system prompt:', err);
    } finally {
      setLoading(false);
    }
  }, [targetMode, onTitleChange]);

  useEffect(() => {
    if (onTitleChange) {
      onTitleChange();
    }
  }, [onTitleChange, targetMode?.name]);

  // Load system prompt only when necessary dependencies change
  useEffect(() => {
    loadSystemPrompt();
  }, [loadSystemPrompt]);

  const copyToClipboard = async () => {
    if (!systemPrompt) return;
    
    try {
      await navigator.clipboard.writeText(systemPrompt.fullContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      new Notice(t('systemPrompt.copy.error'));
    }
  };

  if (loading) {
    return (
      <div className="ln-flex ln-items-center ln-justify-center ln-p-8">
        <div className="ln-flex ln-items-center ln-gap-2">
          <div className="ln-animate-spin">
            <LucideIcon name="loader" size={20} color="var(--text-muted)" />
          </div>
          <span className="ln-text-muted">{t('systemPrompt.loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ln-p-6">
        <div className="ln-bg-secondary ln-border ln-rounded ln-p-4 ln-border-l-4" style={{ borderLeftColor: 'var(--color-red)' }}>
          <div className="ln-flex ln-items-center ln-gap-2 ln-mb-2">
            <LucideIcon name="alert-triangle" size={20} color="var(--color-red)" />
            <h3 className="ln-text-lg ln-font-medium ln-m-0">{t('systemPrompt.error.title')}</h3>
          </div>
          <p className="ln-text-sm ln-text-muted ln-m-0">
            {t('systemPrompt.error.message', { error })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ln-system-prompt-view ln-p-6">
      {/* System prompt content with floating copy button */}
      <div className="ln-system-prompt-container">
        <pre className="ln-system-prompt-content">
          {systemPrompt?.fullContent || t('systemPrompt.empty')}
        </pre>
        
        {/* Floating copy button */}
        <button
          className="ln-floating-action-button"
          onClick={copyToClipboard}
          title={copied ? t('systemPrompt.copy.copied') : t('systemPrompt.copy.button')}
        >
          <LucideIcon 
            name={copied ? "check" : "copy"} 
            size={18} 
            color="var(--text-muted)" 
          />
        </button>
      </div>
    </div>
  );
}; 