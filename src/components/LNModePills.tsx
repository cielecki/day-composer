import React from 'react';
import { LNMode } from 'src/types/LNMode';
import { LucideIcon } from 'src/components/LucideIcon';

interface LNModePillProps {
  id: string;
  icon?: string;
  iconColor?: string;
  name: string;
  onClick: (id: string) => void;
}

export const LNModePill: React.FC<LNModePillProps> = ({ id, icon, iconColor, name, onClick }) => {
  return (
    <div
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
    </div>
  );
};

interface LNModePillsProps {
  lnModes: Record<string, LNMode>;
  onModeSelect: (id: string) => void;
}

export const LNModePills: React.FC<LNModePillsProps> = ({ lnModes, onModeSelect }) => {
  // User has modes, so display them
  return (
    <div className="ln-mode-pills-container">
      {Object.values(lnModes).map((mode, index) => (
        <LNModePill
          key={index}
          id={mode.path}
          icon={mode.icon}
          iconColor={mode.icon_color}
          name={mode.name}
          onClick={onModeSelect}
        />
      ))}
    </div>
  );
}; 