import React, { useState, useEffect } from 'react';
import { requestUrl } from 'obsidian';
import { t } from 'src/i18n';
import { getStore } from '../store/plugin-store';
import { LucideIcon } from './LucideIcon';
import { MarkdownRenderer } from './MarkdownRenderer';

interface WhatsNewModalProps {
  onClose: () => void;
  currentVersion: string;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ onClose, currentVersion }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    getStore().setLastViewedWhatsNewVersion(currentVersion);
  }, [currentVersion]);

  return (
    <div className="whats-new-modal-overlay">
      <div className="whats-new-modal">
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
            <MarkdownRenderer 
              content={content}
              className="whats-new-changelog"
            />
          )}
        </div>
      </div>
    </div>
  );
}; 