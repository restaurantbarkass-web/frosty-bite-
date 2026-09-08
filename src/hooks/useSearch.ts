import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FoodItem } from '../types';
import { searchService, AiRecommendationResponse } from '../services/searchService';
import { useAuth } from '../context/AuthContext';

export const useSearch = (allItems: FoodItem[]) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [smartRec, setSmartRec] = useState<AiRecommendationResponse | null>(null);
  const [isProcessingRec, setIsProcessingRec] = useState(false);

  // Compute Search Results synchronously with useMemo to eliminate extra effect and state update
  const results = useMemo(() => {
    const norm = (query || '').trim();
    if (norm.length > 0) {
      return searchService.filterAndRankItems(allItems, norm);
    }
    return [];
  }, [query, allItems]);

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
    searchService.getTrendingSearches()
      .then(setTrending)
      .catch((err) => console.error("Error loading trending searches:", err));
  }, []);

  const allItemsRef = useRef(allItems);
  allItemsRef.current = allItems;

  // Debounced AI Suggestions & Smart Recommendation
  useEffect(() => {
    let active = true;

    if (query.length <= 2) {
      setAiSuggestions(prev => prev.length > 0 ? [] : prev);
      setSmartRec(prev => prev !== null ? null : prev);
      setIsProcessingRec(prev => prev ? false : prev);
      return;
    }

    const timer = setTimeout(async () => {
      const itemsToUse = allItemsRef.current;
      if (itemsToUse.length > 0) {
        // Get Suggestions
        searchService.getAiSuggestions(query, itemsToUse).then(s => {
          if (active) setAiSuggestions(s);
        }).catch((err) => {
          console.error("Error getting AI suggestions:", err);
        });
        
        // Fetch Smart AI Recommendation automatically while typing
        setIsProcessingRec(true);
        const processingTimeout = setTimeout(() => {
          if (active) setIsProcessingRec(false);
        }, 15000); // 15s safety timeout

        searchService.getSmartRecommendation(query, itemsToUse).then(rec => {
          if (!active) return;
          setSmartRec(rec);
          setIsProcessingRec(false);
          clearTimeout(processingTimeout);
        }).catch(() => {
          if (!active) return;
          setSmartRec(null);
          setIsProcessingRec(false);
          clearTimeout(processingTimeout);
        });
      }
    }, 800);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const performSearch = useCallback(async (searchTerm: string) => {
    const trimmed = (searchTerm || '').trim();
    if (!trimmed) return;

    setQuery(trimmed);
    
    try {
      // Log search for analytics and history
      await searchService.logSearch(trimmed, user?.uid || 'guest');
    } catch (err) {
      console.warn('Logging search failed:', err);
    }

    // Update local recent searches
    setRecent(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 8);
      localStorage.setItem('frosty_recent_searches', JSON.stringify(updated));
      return updated;
    });
  }, [user?.uid]);

  const removeRecent = useCallback((term: string) => {
    setRecent(prev => {
      const updated = prev.filter(s => s !== term);
      localStorage.setItem('frosty_recent_searches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    localStorage.removeItem('frosty_recent_searches');
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setAiSuggestions([]);
    setSmartRec(null);
    setIsProcessingRec(false);
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
    smartRec,
    isProcessingRec,
    performSearch,
    removeRecent,
    clearRecent,
    clear
  };
};
