import React from 'react';

/**
 * Component for rendering tool inputs in a more human-readable format
 */
export const ToolInputDisplay: React.FC<{ 
  toolName: string;
  toolInput: any;
}> = ({ toolName, toolInput }) => {
  // Guard against null/undefined inputs
  if (!toolInput || typeof toolInput !== 'object') {
    return <pre className="tool-input-content"><code>{JSON.stringify(toolInput, null, 2)}</code></pre>;
  }

  const renderValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="ln-tool-input__value ln-tool-input__value--null">not specified</span>;
    }
    
    if (typeof value === 'boolean') {
      return <span className="ln-tool-input__value ln-tool-input__value--boolean">{value ? 'yes' : 'no'}</span>;
    }
    
    if (typeof value === 'number') {
      return <span className="ln-tool-input__value ln-tool-input__value--number">{value}</span>;
    }
    
    if (typeof value === 'string') {
      // Check if the string contains line breaks
      if (value.includes('\n')) {
        // Multi-line string - render in a pre element to preserve line breaks
        return (
          <pre className="ln-tool-input__value ln-tool-input__value--string ln-tool-input__value--multiline">
            {value}
          </pre>
        );
      } else {
        // Single-line string - render normally
        return <span className="ln-tool-input__value ln-tool-input__value--string">"{value}"</span>;
      }
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="ln-tool-input__value ln-tool-input__value--empty">empty list</span>;
      }
      
      // Generic array handling - no special cases for specific tools
      return (
        <div className="ln-tool-input__array">
          {value.map((item, index) => (
            <div key={index} className="ln-tool-input__array-item">
              {renderValue(item)}
            </div>
          ))}
        </div>
      );
    }
    
    // For objects, render as compact key-value pairs
    return (
      <div className="ln-tool-input__object">
        {Object.entries(value).map(([key, val]) => (
          <div key={key} className="ln-tool-input__object-item">
            {key}: {renderValue(val)}
          </div>
        ))}
      </div>
    );
  };

  // Render the tool input in a compact format
  return (
    <div className="ln-tool-input">
      {Object.entries(toolInput).map(([key, value]) => (
        <div key={key} className="ln-tool-input__field">
          <span className="ln-tool-input__field-name">{key}:</span> {renderValue(value)}
        </div>
      ))}
    </div>
  );
}; 