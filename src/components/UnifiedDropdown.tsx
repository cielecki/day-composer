import React, { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { LucideIcon } from './LucideIcon';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: string;
  iconColor?: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'action' | 'item' | 'separator';
}

export interface DropdownSection {
  label?: string;
  items: DropdownItem[];
}

interface UnifiedDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: ReactNode;
  triggerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  dropdownClassName?: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  maxHeight?: number;
  minWidth?: number;
  maxWidth?: number;
  
  // Simple items mode
  items?: DropdownItem[];
  
  // Sections mode  
  sections?: DropdownSection[];
  
  // Custom content mode
  children?: ReactNode;
  
  // Search functionality
  searchable?: boolean;
  searchPlaceholder?: string;
  searchPosition?: 'top' | 'bottom';
  onSearch?: (query: string) => void;
  
  // Loading and empty states
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
  emptyIcon?: string;
}

export const UnifiedDropdown: React.FC<UnifiedDropdownProps> = ({
  isOpen,
  onClose,
  trigger,
  triggerRef,
  className = '',
  dropdownClassName = '',
  position = 'bottom-left',
  maxHeight = 400,
  minWidth = 200,
  maxWidth,
  items = [],
  sections = [],
  children,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchPosition = 'top',
  onSearch,
  loading = false,
  loadingText = 'Loading...',
  emptyText = 'No items found',
  emptyIcon = 'search'
}) => {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle search - use internal state for UI, call parent callback for logic
  const handleSearch = useCallback((query: string) => {
    setInternalSearchQuery(query);
    onSearch?.(query);
  }, [onSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef?.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, searchable]);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setInternalSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const positionClasses = {
    'bottom-left': 'ln-dropdown-bottom-left',
    'bottom-right': 'ln-dropdown-bottom-right', 
    'top-left': 'ln-dropdown-top-left',
    'top-right': 'ln-dropdown-top-right'
  };

  const renderItem = (item: DropdownItem, index: number) => {
    if (item.type === 'separator') {
      return <div key={`separator-${index}`} className="ln-dropdown-separator" />;
    }

    return (
      <div
        key={item.id}
        className={`ln-dropdown-item ${item.type === 'action' ? 'ln-dropdown-action-item' : 'ln-dropdown-list-item'} ${item.className || ''} ${item.disabled ? 'disabled' : ''}`}
        onClick={item.disabled ? undefined : () => {
          item.onClick();
          onClose();
        }}
      >
        {item.icon && (
          <span className="ln-dropdown-item-icon">
            <LucideIcon name={item.icon} size={14} color={item.iconColor || "var(--text-normal)"} />
          </span>
        )}
        <span className="ln-dropdown-item-label">{item.label}</span>
      </div>
    );
  };

  const renderContent = () => {
    // Custom content mode
    if (children) {
      return children;
    }

    // Loading state
    if (loading) {
      return (
        <div className="ln-dropdown-loading">
          <LucideIcon name="loader-2" size={16} className="animate-spin" />
          <span>{loadingText}</span>
        </div>
      );
    }

    // Sections mode
    if (sections.length > 0) {
      return sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="ln-dropdown-section">
          {section.label && (
            <div className="ln-dropdown-section-label">{section.label}</div>
          )}
          {section.items.map((item, itemIndex) => renderItem(item, itemIndex))}
        </div>
      ));
    }

    // Simple items mode
    if (items.length > 0) {
      return items.map((item, index) => renderItem(item, index));
    }

    // Empty state
    return (
      <div className="ln-dropdown-empty">
        <LucideIcon name={emptyIcon} size={16} color="var(--text-muted)" />
        <span>{emptyText}</span>
      </div>
    );
  };

  const renderSearch = () => (
    <div className="ln-dropdown-search-header">
      <input
        ref={searchInputRef}
        type="text"
        placeholder={searchPlaceholder}
        value={internalSearchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="ln-dropdown-search-input"
      />
    </div>
  );

  return (
    <div
      ref={dropdownRef}
      className={`ln-dropdown ${positionClasses[position]} ${dropdownClassName}`}
      style={{
        maxHeight: `${maxHeight}px`,
        minWidth: `${minWidth}px`,
        ...(maxWidth && { maxWidth: `${maxWidth}px` })
      }}
    >
      {searchable && searchPosition === 'top' && renderSearch()}

      <div className="ln-dropdown-content">
        {renderContent()}
      </div>

      {searchable && searchPosition === 'bottom' && renderSearch()}
    </div>
  );
};

// Hook for managing dropdown state
export const useDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    toggle,
    open,
    close,
    triggerRef
  };
}; 