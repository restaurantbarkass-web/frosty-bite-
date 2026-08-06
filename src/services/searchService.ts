import { supabase } from '../supabase';
import { FoodItem } from '../types';
import { MENU_ITEMS } from '../constants';
import { diagnosticFetch } from '../utils/apiDiagnostics';

// AI is now handled server-side to keep API keys secure
// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface SearchHistory {
  id?: string;
  query: string;
  user_id: string;
  created_at: string;
}

export interface SearchAnalytics {
  query: string;
  count: number;
  last_searched: string;
}

export interface AiRecommendationResponse {
  bestMatchId: string;
  reason: string;
  intent: string;
  alternatives: string[];
  isEmotionalMatch: boolean;
  occasionDetected: string;
  moodDetected: string;
  budgetDetected?: string;
  recommendationType: 'occasion' | 'flavor' | 'budget' | 'trending' | 'standard';
  butlerResponse: string;
}

export function getLocalClientRecommendation(query: string, items: FoodItem[]): AiRecommendationResponse | null {
  const norm = query.toLowerCase().trim();
  const activeItems = (items && items.length > 0) ? items : MENU_ITEMS;
  if (!activeItems || activeItems.length === 0) return null;

  // Filter out unavailable items if applicable
  const availableItems = activeItems.filter(i => i.available !== false);
  const pool = availableItems.length > 0 ? availableItems : activeItems;

  // Find matches
  let matchedItems = pool.filter(i => 
    i.name.toLowerCase().includes(norm) || 
    i.category.toLowerCase().includes(norm) ||
    (Array.isArray(i.tags) && i.tags.some(t => t.toLowerCase().includes(norm)))
  );

  if (matchedItems.length === 0) {
    matchedItems = pool;
  }

  // Sort by recommendation flag, then rating
  matchedItems.sort((a, b) => {
    if (a.is_recommended && !b.is_recommended) return -1;
    if (!a.is_recommended && b.is_recommended) return 1;
    return (b.rating || 0) - (a.rating || 0);
  });

  const firstItem = matchedItems[0];
  const secondItem = matchedItems[1] || pool[0] || firstItem;
  const thirdItem = matchedItems[2] || pool[1] || firstItem;

  return {
    bestMatchId: String(firstItem.id),
    reason: `Our custom handcrafted ${firstItem.name} matches your desire for a premium indulgence.`,
    intent: "Artisan Culinary Experience",
    alternatives: [String(secondItem.id), String(thirdItem.id)].filter(id => id !== String(firstItem.id)),
    isEmotionalMatch: true,
    occasionDetected: "Indulgent Moment",
    moodDetected: "Refined",
    recommendationType: "standard",
    butlerResponse: `A magnificent selection, sir. This custom-baked ${firstItem.name} showcases the very zenith of our confectionary art.`
  };
}

export const searchService = {
  // Better AI suggestions with intent prediction
  async getAiSuggestions(searchTerm: string, items: FoodItem[]): Promise<string[]> {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    try {
      const menuReference = items.map(i => ({ name: i.name, category: i.category, tags: i.tags })).slice(0, 60);
      
      const response = await fetch('/api/butler/suggestions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ searchTerm, items: menuReference })
      });

      if (!response.ok) throw new Error('AI Suggestion API failed');
      const data = await response.json();
      return data.suggestions || [];
    } catch (error) {
      console.error('AI Suggestion Error:', error);
      return [];
    }
  },

  // Deep AI Recommendation Engine v2
  async getSmartRecommendation(query: string, items: FoodItem[]): Promise<AiRecommendationResponse | null> {
    if (!query || query.trim().length < 2) return null;
    const activeItems = (items && items.length > 0) ? items : MENU_ITEMS;

    try {
      // Get a broad set of items to give the AI context
      const relevantItems = activeItems.filter(i => i.available !== false).slice(0, 100).map(i => ({
        id: i.id,
        name: i.name,
        category: i.category,
        description: i.description,
        ai_description: i.ai_description,
        price: i.price,
        tags: i.tags,
        is_recommended: i.is_recommended,
        is_ai_boosted: i.is_ai_boosted
      }));

      const response = await fetch('/api/butler/recommend', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query, items: relevantItems })
      });

      if (!response.ok) {
        let errorBody = "";
        try {
          errorBody = await response.text();
        } catch (e) {
          errorBody = "Could not read error response";
        }
        
        if (response.status === 429) {
          console.log(`[SearchService] Butler AI matches rate-limit of 429. Silently deploying local matching backend...`);
        } else {
          console.warn(`[SearchService] Butler API returned code ${response.status}. Deploying client matches.`);
        }
        return getLocalClientRecommendation(query, activeItems);
      }
      
      const recommendation = await response.json();
      console.log('[Butler Rec] AI Success Payload:', recommendation);
      
      if (!recommendation || !recommendation.bestMatchId) {
        return getLocalClientRecommendation(query, activeItems);
      }

      // Verify item exists - force string comparison
      const validItem = activeItems.find(i => String(i.id) === String(recommendation.bestMatchId));
      if (!validItem) {
        console.warn(`[Butler Rec] Recommended ID ${recommendation.bestMatchId} not found in current items list, using client fallback.`);
        return getLocalClientRecommendation(query, activeItems);
      }

      return recommendation;
    } catch (error) {
      console.warn('[SearchService] Smart Rec Engine connection issue. Deploying client matches:', error);
      return getLocalClientRecommendation(query, activeItems);
    }
  },

  // Record a search for analytics
  async logSearch(searchTerm: string, userId: string = 'anonymous') {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) return;
    try {
      await diagnosticFetch('/api/search/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm: trimmed, userId })
      });
    } catch (error) {
      console.error('Logging Search Error:', error);
    }
  },

  // Get trending searches
  async getTrendingSearches(limitCount: number = 6): Promise<string[]> {
    const fallback = ['Anniversary Cakes', 'Chocolate Truffle', 'Coffee Pastries', 'Custom Gifts', 'Cupcakes', 'Fresh Fruit Cake'];
    try {
      const res = await diagnosticFetch(`/api/search/trending?limit=${limitCount}`);
      if (!res.ok) return fallback.slice(0, limitCount);
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 ? data : fallback.slice(0, limitCount);
    } catch {
      return fallback.slice(0, limitCount);
    }
  },

  // Basic ranking for non-AI fallback
  filterAndRankItems(items: FoodItem[], searchTerm: string): FoodItem[] {
    const rawQuery = searchTerm.toLowerCase().trim();
    if (!rawQuery) return [];

    // Basic singularization (removing trailing 's') for better plural/singular match
    const queries = [rawQuery];
    if (rawQuery.endsWith('s')) {
      queries.push(rawQuery.substring(0, rawQuery.length - 1));
    } else {
      queries.push(rawQuery + 's');
    }

    return items
      .map(item => {
        let score = 0;
        const name = item.name.toLowerCase();
        const category = item.category.toLowerCase();
        const description = (item.description || '').toLowerCase();
        const tags = (item.tags || []).map(t => t.toLowerCase());

        queries.forEach((q, idx) => {
          const weight = idx === 0 ? 1 : 0.8; // Primary query has full weight

          if (name === q) score += 100 * weight;
          else if (name.startsWith(q)) score += 50 * weight;
          else if (name.includes(q)) score += 20 * weight;
          
          if (category.includes(q)) score += 30 * weight;
          if (tags.some(t => t.includes(q))) score += 25 * weight;
          if (description.includes(q)) score += 10 * weight;
        });

        // Boost items with AI boosting
        if (item.is_ai_boosted) score *= 1.2;

        return { item, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);
  }
};

