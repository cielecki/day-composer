import React from 'react';
import { t } from '../i18n';

interface ThinkingMessageProps {
  status: 'recording' | 'transcribing' | 'thinking' | 'speaking';
}

export const ThinkingMessage: React.FC<ThinkingMessageProps> = ({ status }) => {
  return (
    <div className="thinking-message">
      <div className="thinking-indicator">
        <div className="thinking-dot"></div>
        <div className="thinking-dot"></div>
        <div className="thinking-dot"></div>
        <span className="thinking-text">{t(`ui.status.${status}`)}</span>
      </div>
    </div>
  );
}; 