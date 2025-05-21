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

export const LNModePill: React.FC<AICModePillProps> = ({ id, icon, iconColor, name, onClick }) => {
  return (
    <button
      className="ln-mode-pill"
      onClick={() => onClick(id)}
      title={name}
      data-icon-color={iconColor || 'var(--text-normal)'}
      style={{ 
        '--icon-color': iconColor || 'var(--text-normal)'
      } as React.CSSProperties}
    >
      {icon && (
        <div className="ln-mode-icon-container">
          <LucideIcon 
            name={icon} 
            size={16}
            className="ln-mode-icon"
            color={iconColor}
          />
        </div>
      )}
      <span className="ln-mode-name">{name}</span>
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
    <div className="ln-mode-pills-container">
      {Object.values(aicModes).map((mode, index) => (
        <LNModePill
          key={index}
          id={mode.ln_path}
          icon={mode.ln_icon}
          iconColor={mode.ln_icon_color}
          name={mode.ln_name}
          onClick={onModeSelect}
        />
      ))}
    </div>
  );
}; 