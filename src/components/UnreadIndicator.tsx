import React from 'react';

interface UnreadIndicatorProps {
  isUnread: boolean;
  className?: string;
}

export const UnreadIndicator: React.FC<UnreadIndicatorProps> = ({ 
  isUnread, 
  className = '' 
}) => {
  if (!isUnread) return null;

  return (
    <span 
      className={`ln-unread-indicator ${className}`}
      aria-label="Unread messages"
    />
  );
}; 