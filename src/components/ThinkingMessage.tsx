import React from 'react';

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
      </div>
    </div>
  );
}; 