import React from 'react';
import { t } from 'src/i18n';

interface RecordingIndicatorProps {
  waveformData: number[];
}

const WAVEFORM_HISTORY_LENGTH = 120; // 4 seconds at 30 samples per second

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({ 
  waveformData 
}) => {
  return (
    <div className="waveform-container">
      <div className="waveform">
        {waveformData.map((level, index) => (
          <div
            key={index}
            className="waveform-bar ln-waveform-bar-dynamic"
            style={{
              height: `${level}%`,
              opacity: Math.max(
                0.3,
                index / WAVEFORM_HISTORY_LENGTH,
              ),
            }}
          />
        ))}
      </div>
    </div>
  );
}; 