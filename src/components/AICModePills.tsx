import React from 'react';
import { AICMode } from '../types/types';
import { LucideIcon } from './LucideIcon';

interface AICModePillProps {
  id: string;
  icon?: string;
  iconColor?: string;
  name: string;
  onClick: (id: string) => void;
}

export const AICModePill: React.FC<AICModePillProps> = ({ id, icon, iconColor, name, onClick }) => {
  return (
    <button
      className="aic-mode-pill"
      onClick={() => onClick(id)}
      title={name}
      data-icon-color={iconColor || 'var(--text-normal)'}
      style={{ 
        '--icon-color': iconColor || 'var(--text-normal)'
      } as React.CSSProperties}
    >
      {icon && (
        <div className="aic-mode-icon-container">
          <LucideIcon 
            name={icon} 
            size={16}
            className="aic-mode-icon"
            color={iconColor}
          />
        </div>
      )}
      <span className="aic-mode-name">{name}</span>
    </button>
  );
};

interface AICModePillsProps {
  aicModes: Record<string, AICMode>;
  onModeSelect: (id: string) => void;
}

export const AICModePills: React.FC<AICModePillsProps> = ({ aicModes, onModeSelect }) => {
  // User has modes, so display them
  return (
    <div className="aic-mode-pills-container">
      {Object.values(aicModes).map((mode, index) => (
        <AICModePill
          key={index}
          id={mode.aic_path}
          icon={mode.aic_icon}
          iconColor={mode.aic_icon_color}
          name={mode.aic_name}
          onClick={onModeSelect}
        />
      ))}
    </div>
  );
}; 