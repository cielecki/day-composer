import React from 'react';
import { LucideIcon } from './LucideIcon';
import { t } from '../i18n';

interface TranscribingIndicatorProps {
  onStop: () => void;
}

export const TranscribingIndicator: React.FC<TranscribingIndicatorProps> = ({ onStop }) => {
  return (
    <div className="transcribing-overlay" onClick={onStop}>
        {t("ui.transcribing.inProgress")}
    </div>
  );
}; 