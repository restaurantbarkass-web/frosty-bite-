import { useState, useEffect, useCallback, useMemo } from 'react';
import { FoodItem } from '../types';
import { searchService } from '../services/searchService';
import { useAuth } from '../context/AuthContext';

export const useSearch = (allItems: FoodItem[]) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('frosty_recent_searches');
    if (saved) {
      try {
        setRecent(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    
    // Load trending
    searchService.getTrendingSearches().then(setTrending);
  }, []);

  // Handle Search Result Updates
  useEffect(() => {
    if (query.trim().length > 0) {
      const filtered = searchService.filterAndRankItems(allItems, query);
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, [query, allItems]);

  // Debounced AI Suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2) {
        const suggestions = await searchService.getAiSuggestions(query);
        setAiSuggestions(suggestions);
      } else {
        setAiSuggestions([]);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = useCallback(async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    setQuery(trimmed);
    
    // Log search for analytics and history
    await searchService.logSearch(trimmed, user?.uid || 'guest');

    // Update local recent searches
    setRecent(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 5);
      localStorage.setItem('frosty_recent_searches', JSON.stringify(updated));
      return updated;
    });
  }, [user]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setAiSuggestions([]);
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    setIsSearching,
    aiSuggestions,
    trending,
    recent,
    performSearch,
    clear
  };
};
