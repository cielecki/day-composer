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
            // Since ReactMarkdown doesn't reliably set the inline parameter,
            // we detect inline vs block code using node properties and content
            const isInlineCode = props.node?.tagName === 'code' || 
                               (typeof children === 'string' && !children.includes('\n'));
            
            if (isInlineCode) {
              return <code className={className}>{children}</code>;
            } else {
              return (
                <pre className="code-block">
                  <code className={className}>
                    {children}
                  </code>
                </pre>
              );
            }
          },
          p: ({children, ...props}: any) => {
            // Check if this paragraph contains only a pre element to avoid nesting
            if (React.Children.count(children) === 1) {
              const childArray = React.Children.toArray(children);
              const child = childArray[0];
              if (React.isValidElement(child) && child.type === 'pre') {
                // Return the pre element directly without wrapping in p
                return child;
              }
            }
            // Otherwise, render as normal paragraph
            return <p>{children}</p>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}; 