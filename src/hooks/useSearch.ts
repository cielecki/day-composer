import { useState, useEffect, useMemo, useCallback } from 'react';

export interface UseSearchOptions {
  debounceMs?: number;
  caseSensitive?: boolean;
  minQueryLength?: number;
}

export interface UseSearchResult<T> {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearch: (query: string) => void;
  filteredItems: T[];
  hasQuery: boolean;
  isSearching: boolean;
}

/**
 * Unified search hook for filtering arrays of items
 * @param items - Array of items to search through
 * @param searchFields - Function that returns searchable strings for each item
 * @param options - Search configuration options
 */
export const useSearch = <T>(
  items: T[],
  searchFields: (item: T) => string[],
  options: UseSearchOptions = {}
): UseSearchResult<T> => {
  const {
    debounceMs = 0,
    caseSensitive = false,
    minQueryLength = 0
  } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Debouncing logic
  useEffect(() => {
    if (debounceMs > 0) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setDebouncedQuery(searchQuery);
        setIsSearching(false);
      }, debounceMs);

      return () => {
        clearTimeout(timer);
        setIsSearching(false);
      };
    } else {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }
  }, [searchQuery, debounceMs]);

  // Filtering logic
  const filteredItems = useMemo(() => {
    const query = debouncedQuery.trim();
    
    // Return all items if query is too short or empty
    if (!query || query.length < minQueryLength) {
      return items;
    }

    const searchTerm = caseSensitive ? query : query.toLowerCase();
    
    return items.filter(item => {
      const fields = searchFields(item);
      return fields.some(field => {
        const searchableField = caseSensitive ? field : field.toLowerCase();
        return searchableField.includes(searchTerm);
      });
    });
  }, [items, debouncedQuery, searchFields, caseSensitive, minQueryLength]);

  // Handle search with callback support
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Reset search when items change significantly
  useEffect(() => {
    if (items.length === 0 && searchQuery) {
      setSearchQuery('');
    }
  }, [items.length, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    handleSearch,
    filteredItems,
    hasQuery: Boolean(debouncedQuery.trim()),
    isSearching
  };
}; 