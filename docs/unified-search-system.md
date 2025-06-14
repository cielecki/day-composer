# Unified Search System

## Overview

The Life Navigator plugin now features a completely unified search system that eliminates code duplication and provides consistent search behavior across all dropdown components. The system is built around a central `useSearch` hook that handles all search logic, filtering, and state management.

## Architecture

### Core Components

1. **`useSearch` Hook** (`src/hooks/useSearch.ts`)
   - Central search logic and state management
   - Configurable debouncing, case sensitivity, and minimum query length
   - Generic type support for any data structure
   - Consistent API across all implementations

2. **`UnifiedDropdown` Component** (`src/components/UnifiedDropdown.tsx`)
   - Provides search UI (input field, styling, focus management)
   - Delegates search logic to parent components via `onSearch` callback
   - Maintains internal UI state for input field display

3. **Specialized Dropdown Components**
   - Use `useSearch` hook for filtering logic
   - Pass search handler to `UnifiedDropdown`
   - Implement custom search field extraction

## useSearch Hook API

### Interface

```typescript
interface UseSearchOptions {
  debounceMs?: number;        // Debounce delay (default: 0)
  caseSensitive?: boolean;    // Case sensitive search (default: false)
  minQueryLength?: number;    // Minimum query length (default: 0)
}

interface UseSearchResult<T> {
  searchQuery: string;                    // Current search query
  setSearchQuery: (query: string) => void; // Set search query
  handleSearch: (query: string) => void;   // Search handler for callbacks
  filteredItems: T[];                     // Filtered results
  hasQuery: boolean;                      // Whether there's an active query
  isSearching: boolean;                   // Whether debounce is in progress
}
```

### Usage Pattern

```typescript
const search = useSearch(
  items,                    // Array of items to search
  (item) => [              // Function returning searchable strings
    item.name,
    item.description || ''
  ],
  {                        // Options
    debounceMs: 300,
    caseSensitive: false,
    minQueryLength: 1
  }
);

// Use in component
<UnifiedDropdown
  searchable={true}
  onSearch={search.handleSearch}
  emptyText={search.hasQuery ? 'No results' : 'No items'}
>
  {search.filteredItems.map(item => (
    <div key={item.id}>{item.name}</div>
  ))}
</UnifiedDropdown>
```

## Implementation Examples

### 1. Mode Dropdown Search

**File**: `src/components/ModeDropdown.tsx`

```typescript
// Convert object to array for search hook
const modesArray = Object.values(availableModes);

// Configure search for mode name and description
const search = useSearch(
  modesArray,
  (mode: any) => [
    mode.name || '',
    mode.description || ''
  ]
);

// Convert back to object format for compatibility
const filteredModes = Object.fromEntries(
  search.filteredItems.map((mode: any) => [mode.path, mode])
);
```

**Features**:
- Searches mode names and descriptions
- Instant filtering (no debounce)
- Case-insensitive search
- Hides action items (edit, view prompt) during search for cleaner results

### 2. Conversation History Search

**File**: `src/components/ConversationHistoryDropdown.tsx`

```typescript
// Search with debouncing for metadata loading
const search = useSearch(
  conversationItems,
  (item: Chat) => [
    item.storedConversation?.title || ''
  ],
  { 
    debounceMs: 300,
    minQueryLength: 1
  }
);

// Additional filtering for loaded metadata
const filteredConversations = search.filteredItems.filter((item: Chat) => {
  return isMetadataLoaded(item) && item.storedConversation?.title;
});
```

**Features**:
- 300ms debounce to prevent excessive metadata loading
- Searches conversation titles
- Additional filtering for loaded metadata
- Triggers metadata loading when search becomes active

### 3. Chat Menu Dropdown

**File**: `src/components/ChatMenuDropdown.tsx`

The chat menu doesn't use search currently, but could easily be extended:

```typescript
// Potential future enhancement
const search = useSearch(
  menuItems,
  (item) => [item.label, item.description || '']
);
```

## Benefits of Unified System

### 1. Code Reduction
- **Before**: Each dropdown had 20-30 lines of search logic
- **After**: Single `useSearch` hook handles all search logic
- **Eliminated**: ~60 lines of duplicated search code

### 2. Consistency
- **Search Behavior**: Identical across all dropdowns
- **Performance**: Consistent debouncing and filtering
- **User Experience**: Same search patterns everywhere

### 3. Maintainability
- **Single Source**: All search logic in one place
- **Easy Updates**: Changes apply to all dropdowns
- **Testing**: Test once, works everywhere

### 4. Extensibility
- **New Features**: Easy to add fuzzy search, highlighting, etc.
- **New Dropdowns**: Just use the hook, no custom logic needed
- **Configuration**: Flexible options for different use cases

## Advanced Features

### Debouncing
```typescript
const search = useSearch(items, searchFields, {
  debounceMs: 300  // Wait 300ms after user stops typing
});

// Access debounce state
if (search.isSearching) {
  // Show loading indicator
}
```

### Case Sensitivity
```typescript
const search = useSearch(items, searchFields, {
  caseSensitive: true  // Exact case matching
});
```

### Minimum Query Length
```typescript
const search = useSearch(items, searchFields, {
  minQueryLength: 2  // Only search with 2+ characters
});
```

### Multiple Search Fields
```typescript
const search = useSearch(
  items,
  (item) => [
    item.title,
    item.description,
    item.tags?.join(' ') || '',
    item.author || ''
  ]
);
```

## Future Enhancements

### Planned Features
1. **Fuzzy Search**: Approximate string matching
2. **Search Highlighting**: Highlight matching text in results
3. **Search History**: Remember recent searches
4. **Advanced Filters**: Date ranges, categories, etc.
5. **Search Analytics**: Track search patterns

### Implementation Ideas
```typescript
// Fuzzy search
const search = useSearch(items, searchFields, {
  fuzzy: true,
  fuzzyThreshold: 0.6
});

// Highlighting
const search = useSearch(items, searchFields, {
  highlight: true
});

// Access highlighted results
search.filteredItems.forEach(item => {
  console.log(item.highlightedFields); // HTML with <mark> tags
});
```

## Migration Guide

### From Old Search Implementation

**Before** (duplicated in each component):
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(searchQuery);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

const filteredItems = useMemo(() => {
  if (!debouncedQuery) return items;
  return items.filter(item => 
    item.name.toLowerCase().includes(debouncedQuery.toLowerCase())
  );
}, [items, debouncedQuery]);
```

**After** (unified hook):
```typescript
const search = useSearch(
  items,
  (item) => [item.name],
  { debounceMs: 300 }
);

// Use search.filteredItems directly
```

### Steps to Migrate
1. Import `useSearch` hook
2. Replace search state with hook call
3. Update filtering logic to use `search.filteredItems`
4. Update UnifiedDropdown props to use `search.handleSearch`
5. Remove old search state and effects

## Performance Considerations

### Optimizations
- **Memoization**: Search results are memoized automatically
- **Debouncing**: Prevents excessive filtering during typing
- **Early Returns**: Skip filtering for empty/short queries
- **Field Extraction**: Cached searchable strings

### Best Practices
- Use debouncing for expensive operations (API calls, file I/O)
- Keep search fields minimal and relevant
- Consider minimum query length for large datasets
- Use case-insensitive search unless specifically needed

## Testing

### Unit Tests
```typescript
describe('useSearch', () => {
  it('filters items by search query', () => {
    const items = [
      { name: 'Apple', type: 'fruit' },
      { name: 'Banana', type: 'fruit' },
      { name: 'Carrot', type: 'vegetable' }
    ];
    
    const { result } = renderHook(() => 
      useSearch(items, (item) => [item.name, item.type])
    );
    
    act(() => {
      result.current.handleSearch('fruit');
    });
    
    expect(result.current.filteredItems).toHaveLength(2);
  });
});
```

### Integration Tests
- Test search across all dropdown components
- Verify consistent behavior and performance
- Test edge cases (empty queries, special characters, etc.)

## Conclusion

The unified search system provides a robust, maintainable, and extensible foundation for all search functionality in Life Navigator. By centralizing search logic in the `useSearch` hook, we've eliminated code duplication while providing a consistent and powerful search experience across all dropdown interfaces. 