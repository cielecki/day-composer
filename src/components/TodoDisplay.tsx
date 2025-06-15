import React, { useState } from 'react';
import { LucideIcon } from 'src/components/LucideIcon';
import { t } from 'src/i18n';

// Simplified types for todo items
export interface TodoItem {
  todo_text: string; // Everything after the checkbox brackets - includes emojis, time markers, formatting, etc.
  status: 'pending' | 'completed' | 'abandoned' | 'moved';
  notes: string[];
}

// Props needed to enable interactivity
interface TodoDisplayProps {
  todos: TodoItem[];
  fileName: string;
  onCheckTodo?: (todo_text: string) => void;
  onUncheckTodo?: (todo_text: string) => void;
  onAbandonTodo?: (todo_text: string) => void;
}

export const TodoDisplay: React.FC<TodoDisplayProps> = ({ 
  todos, 
  fileName, 
  onCheckTodo,
  onUncheckTodo,
  onAbandonTodo
}) => {
  // Limit to showing only a few items by default
  const [isExpanded, setIsExpanded] = useState(false);
  const initialLimit = 3;
  
  // Show only initialLimit number of items unless expanded
  const visibleTodos = isExpanded ? todos : todos.slice(0, initialLimit);
  const hasMoreItems = todos.length > initialLimit;
  
  // Handle checkbox clicks based on current status
  const handleCheckboxClick = (todo: TodoItem) => {
    if (!onCheckTodo || !onUncheckTodo || !onAbandonTodo) {
      return; // No handlers provided, checkboxes are read-only
    }
    
    if (todo.status === 'pending') {
      onCheckTodo(todo.todo_text);
    } else if (todo.status === 'completed') {
      onUncheckTodo(todo.todo_text);
    } else if (todo.status === 'abandoned') {
      // First uncheck, then can be checked
      onUncheckTodo(todo.todo_text);
    }
    // Moved todos can't be interacted with
  };
  
  // Determine if checkboxes are interactive
  const isInteractive = !!(onCheckTodo && onUncheckTodo && onAbandonTodo);
  
  if (todos.length === 0) {
    return (
      <div className="todo-list-container">
        <div className="todo-list-empty">
          <LucideIcon name="info" color="var(--text-muted)" />
          <span>{t('ui.todo.noTodos', { filename: fileName })}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="todo-list-container">
      <div className="todo-list-header">
        <h3>
          <LucideIcon name="list-checks" className="todo-list-icon" color="var(--text-accent)" />
          <span>{t('ui.todo.selectedFrom', { filename: fileName })}</span>
        </h3>
      </div>
      
      <div className="todo-list">
        {visibleTodos.map((todo, index) => (
          <div key={index} className={`todo-item todo-status-${todo.status}`}>
            <div 
              className={`todo-checkbox ${isInteractive ? 'interactive' : ''}`}
              onClick={() => isInteractive && handleCheckboxClick(todo)}
              title={isInteractive ? t('ui.todo.clickToChange') : t('ui.todo.readOnly')}
            >
              {todo.status === 'pending' && <LucideIcon name="square" color={isInteractive ? 'var(--text-accent)' : 'var(--text-muted)'} />}
              {todo.status === 'completed' && <LucideIcon name="check-square" color="var(--color-green)" />}
              {todo.status === 'abandoned' && <LucideIcon name="x-square" color="var(--color-red)" />}
              {todo.status === 'moved' && <LucideIcon name="arrow-right-square" color="var(--color-blue)" />}
            </div>
            
            <div className="todo-content">
              <div className="todo-main-line">
                <span className="todo-text">{todo.todo_text}</span>
              </div>
              
              {todo.notes.length > 0 && (
                <div className="todo-notes">
                  {todo.notes.map((note, noteIndex) => (
                    <div key={noteIndex} className="todo-note">{note}</div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Context menu for more actions */}
            {isInteractive && todo.status === 'pending' && (
              <div className="todo-actions">
                <button 
                  className="todo-action-button abandon"
                  title={t('ui.todo.abandon')}
                  onClick={() => onAbandonTodo(todo.todo_text)}
                >
                  <LucideIcon name="x" size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
        
        {hasMoreItems && !isExpanded && (
          <button
            className="todo-show-more-button"
            onClick={() => setIsExpanded(true)}
          >
            {(todos.length - initialLimit) === 1 ? t('ui.todo.showMore.singular', { 
              count: todos.length - initialLimit 
            }) : ((todos.length - initialLimit) >= 2 && (todos.length - initialLimit) <= 4 ? t('ui.todo.showMore.few', { 
              count: todos.length - initialLimit 
            }) : t('ui.todo.showMore.many', { 
              count: todos.length - initialLimit 
            }))}
          </button>
        )}
      </div>
    </div>
  );
};
