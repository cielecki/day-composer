# Unified Dropdown Component

This document explains the unified dropdown component system implemented to consolidate the various dropdown implementations across the Life Navigator plugin.

## Overview

Previously, the codebase had three different dropdown implementations:
1. **Chat History Dropdown** - Complex dropdown with search and list items
2. **More Options Dropdown** - Simple menu with icons and separators  
3. **Mode Dropdown** - Dropdown with actions section and mode selection

These have been unified into a single `UnifiedDropdown` component with a flexible API that can handle all these use cases.

## Components

### UnifiedDropdown

The main component that renders the dropdown content.

```tsx
import { UnifiedDropdown, useDropdown } from './UnifiedDropdown';

const MyComponent = () => {
  const dropdown = useDropdown();
  
  return (
    <UnifiedDropdown
      isOpen={dropdown.isOpen}
      onClose={dropdown.close}
      triggerRef={dropdown.triggerRef}
      position="bottom-right"
      items={[
        { id: '1', label: 'Option 1', icon: 'star', onClick: () => {} },
        { id: '2', label: 'Option 2', icon: 'heart', onClick: () => {} }
      ]}
    />
  );
};
```

### useDropdown Hook

Provides state management for dropdown open/close functionality.

```tsx
const dropdown = useDropdown();
// Returns: { isOpen, toggle, open, close, triggerRef }
```

## Usage Patterns

### Simple Menu (Chat Options)

```tsx
const menuItems: DropdownItem[] = [
  {
    id: 'open-tab',
    label: 'Open in New Tab',
    icon: 'external-link',
    onClick: () => openNewTab()
  },
  {
    id: 'separator',
    type: 'separator',
    label: '',
    onClick: () => {}
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'trash',
    onClick: () => deleteItem()
  }
];

<UnifiedDropdown
  isOpen={dropdown.isOpen}
  onClose={dropdown.close}
  triggerRef={dropdown.triggerRef}
  position="bottom-right"
  items={menuItems}
/>
```

### Sections with Actions (Mode Dropdown)

```tsx
const sections: DropdownSection[] = [
  {
    items: [
      { id: 'edit', label: 'Edit Mode', icon: 'edit', onClick: () => {}, type: 'action' },
      { id: 'view', label: 'View Prompt', icon: 'eye', onClick: () => {}, type: 'action' },
      { id: 'sep', type: 'separator', label: '', onClick: () => {} }
    ]
  },
  {
    label: 'Switch to Mode',
    items: [
      { id: 'mode1', label: 'Mode 1', icon: 'star', onClick: () => {} },
      { id: 'mode2', label: 'Mode 2', icon: 'heart', onClick: () => {} }
    ]
  }
];

<UnifiedDropdown
  isOpen={dropdown.isOpen}
  onClose={dropdown.close}
  triggerRef={dropdown.triggerRef}
  position="top-left"
  sections={sections}
/>
```

### Searchable Dropdown (Conversation History)

```tsx
<UnifiedDropdown
  isOpen={dropdown.isOpen}
  onClose={dropdown.close}
  triggerRef={dropdown.triggerRef}
  position="bottom-right"
  searchable={true}
  searchPlaceholder="Search conversations..."
  onSearch={(query) => handleSearch(query)}
  maxHeight={400}
  minWidth={300}
>
  {/* Custom content for complex list items */}
  <div className="conversations-list">
    {conversations.map(conversation => (
      <ConversationItem key={conversation.id} {...conversation} />
    ))}
  </div>
</UnifiedDropdown>
```

### Searchable Dropdown with Bottom Search (Mode Dropdown)

For dropdowns that open upward, place search at the bottom for better UX:

```tsx
<UnifiedDropdown
  isOpen={dropdown.isOpen}
  onClose={dropdown.close}
  triggerRef={dropdown.triggerRef}
  position="top-left"
  searchable={true}
  searchPlaceholder="Search modes..."
  searchPosition="bottom"
  onSearch={(query) => handleSearch(query)}
  sections={modeSections}
/>
```

## API Reference

### UnifiedDropdownProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | - | Whether dropdown is open |
| `onClose` | `() => void` | - | Callback when dropdown should close |
| `triggerRef` | `RefObject<HTMLElement>` | - | Ref to trigger element |
| `position` | `'bottom-left' \| 'bottom-right' \| 'top-left' \| 'top-right'` | `'bottom-left'` | Dropdown position |
| `maxHeight` | `number` | `400` | Maximum height in pixels |
| `minWidth` | `number` | `200` | Minimum width in pixels |
| `maxWidth` | `number` | - | Maximum width in pixels |
| `items` | `DropdownItem[]` | `[]` | Simple items mode |
| `sections` | `DropdownSection[]` | `[]` | Sections mode |
| `children` | `ReactNode` | - | Custom content mode |
| `searchable` | `boolean` | `false` | Enable search functionality |
| `searchPlaceholder` | `string` | `'Search...'` | Search input placeholder |
| `searchPosition` | `'top' \| 'bottom'` | `'top'` | Position of search input |
| `onSearch` | `(query: string) => void` | - | Search callback |
| `loading` | `boolean` | `false` | Show loading state |
| `emptyText` | `string` | `'No items found'` | Empty state text |

### DropdownItem

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique identifier |
| `label` | `string` | Display text |
| `icon` | `string` | Lucide icon name |
| `iconColor` | `string` | Icon color |
| `onClick` | `() => void` | Click handler |
| `type` | `'action' \| 'item' \| 'separator'` | Item type |
| `disabled` | `boolean` | Disabled state |
| `className` | `string` | Additional CSS classes |

## Styling

The unified dropdown uses CSS classes with the `ln-dropdown` prefix:

- `.ln-dropdown` - Main container
- `.ln-dropdown-item` - Individual items
- `.ln-dropdown-separator` - Separator lines
- `.ln-dropdown-search-header` - Search section
- `.ln-dropdown-loading` - Loading state
- `.ln-dropdown-empty` - Empty state

Position classes:
- `.ln-dropdown-bottom-left`
- `.ln-dropdown-bottom-right`
- `.ln-dropdown-top-left`
- `.ln-dropdown-top-right`

## Migration Guide

### From Chat Menu Dropdown

**Before:**
```tsx
<div className="ln-chat-menu-dropdown">
  <div className="ln-chat-menu-item" onClick={handleClick}>
    <LucideIcon name="external-link" size={16} />
    <span>Open in New Tab</span>
  </div>
</div>
```

**After:**
```tsx
<UnifiedDropdown
  items={[
    { id: 'open-tab', label: 'Open in New Tab', icon: 'external-link', onClick: handleClick }
  ]}
/>
```

### From Mode Dropdown

**Before:**
```tsx
<div className="ln-mode-dropdown">
  <div className="ln-mode-action-item">...</div>
  <div className="ln-separator" />
  <div className="ln-mode-list-item">...</div>
</div>
```

**After:**
```tsx
<UnifiedDropdown
  sections={[
    { items: [/* actions */] },
    { label: 'Switch to Mode', items: [/* modes */] }
  ]}
/>
```

## Benefits

1. **Consistency** - All dropdowns have the same behavior and styling
2. **Maintainability** - Single component to maintain instead of three
3. **Flexibility** - Supports all existing use cases plus new ones
4. **Accessibility** - Consistent keyboard navigation and screen reader support
5. **Performance** - Shared logic reduces bundle size
6. **Developer Experience** - Simple API with TypeScript support

## Future Enhancements

- Keyboard navigation support
- Virtual scrolling for large lists
- Animation transitions
- Custom positioning logic
- Accessibility improvements (ARIA attributes)
- Mobile touch support 