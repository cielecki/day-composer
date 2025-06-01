import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Shared MarkdownRenderer component that handles code blocks and paragraph wrapping correctly
 * to prevent hydration errors from <pre> elements being nested inside <p> elements.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = "markdown-content" 
}) => {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({inline, className, children, ...props}: any) => {
            return !inline ? (
              <pre className="code-block">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className={className} {...props}>{children}</code>
            );
          },
          p: ({children, ...props}: any) => {
            // Check if this paragraph contains only a pre element
            if (React.Children.count(children) === 1) {
              const childArray = React.Children.toArray(children);
              const child = childArray[0];
              if (React.isValidElement(child) && child.type === 'pre') {
                // Return the pre element directly without wrapping in p
                return child;
              }
            }
            // Otherwise, render as normal paragraph
            return <p {...props}>{children}</p>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}; 