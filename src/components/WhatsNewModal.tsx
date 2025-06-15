import React, { useState, useEffect } from 'react';
import { requestUrl } from 'obsidian';
import { t } from 'src/i18n';
import { getStore } from '../store/plugin-store';
import { LucideIcon } from './LucideIcon';

interface WhatsNewModalProps {
  onClose: () => void;
  currentVersion: string;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ onClose, currentVersion }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    fetchChangelog();
  }, []);

  const fetchChangelog = async () => {
    try {
      setIsLoading(true);
      const response = await requestUrl({
        url: 'https://raw.githubusercontent.com/cielecki/life-navigator/main/CHANGELOG.md',
        method: 'GET',
      });
      
      if (response.status === 200) {
        setContent(response.text);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch changelog:', err);
      setError(t('whatsNew.errors.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = async () => {
    if (dontShowAgain) {
      const store = getStore();
      await store.setLastViewedWhatsNewVersion(currentVersion);
    }
    onClose();
  };

  const formatMarkdown = (content: string): string => {
    return content
      // Headers (add a marker to detect them later)
      .replace(/^### (.*$)/gm, '<h3 class="whats-new-h3">$1</h3>{{HEADER}}')
      .replace(/^## (.*$)/gm, '<h2 class="whats-new-h2">$1</h2>{{HEADER}}')
      .replace(/^# (.*$)/gm, '<h1 class="whats-new-h1">$1</h1>{{HEADER}}')
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="whats-new-bold">$1</strong>')
      // Code blocks
      .replace(/`([^`]+)`/g, '<code class="whats-new-code">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="whats-new-link">$1</a>')
      // Convert line breaks to <br> but avoid double breaks after headers
      .replace(/\n/g, '<br>')
      // Remove excessive breaks after headers (header + marker + br)
      .replace(/\{\{HEADER\}\}<br>/g, '')
      // Clean up the header markers
      .replace(/\{\{HEADER\}\}/g, '')
      // Convert double line breaks to single paragraph breaks
      .replace(/<br><br>/g, '<br>');
  };

  return (
    <div className="whats-new-modal-overlay">
      <div className="whats-new-modal">
        <div className="whats-new-header">
          <div className="whats-new-title-container">
            <LucideIcon 
              name="sparkles" 
              size={20} 
              color="var(--interactive-accent)" 
              className="whats-new-icon"
            />
            <h2 className="whats-new-title">{t('whatsNew.title')}</h2>
          </div>
        </div>

        <div className="whats-new-content">
          {isLoading && (
            <div className="whats-new-loading">
              <LucideIcon 
                name="loader-2" 
                size={20} 
                color="var(--text-muted)" 
                className="animate-spin"
              />
              <p>{t('whatsNew.loading')}</p>
            </div>
          )}
          
          {error && (
            <div className="whats-new-error">
              <LucideIcon 
                name="alert-circle" 
                size={20} 
                color="var(--color-red)" 
              />
              <p>{error}</p>
              <p className="whats-new-fallback">
                <a 
                  href="https://github.com/cielecki/life-navigator/blob/main/CHANGELOG.md" 
                  target="_blank" 
                  className="whats-new-fallback-link"
                >
                  {t('whatsNew.errors.viewOnGitHub')}
                </a>
              </p>
            </div>
          )}
          
          {!isLoading && !error && content && (
            <div 
              className="whats-new-changelog"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
            />
          )}
        </div>

        <div className="whats-new-footer">
          <div className="whats-new-checkbox-container">
            <input
              type="checkbox"
              id="dont-show-again"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="whats-new-checkbox"
            />
            <label htmlFor="dont-show-again" className="whats-new-checkbox-label">
              {t('whatsNew.dontShowAgain')}
            </label>
          </div>
          
          <button onClick={handleClose} className="whats-new-close-button">
            {t('buttons.close')}
          </button>
        </div>
      </div>
    </div>
  );
}; 