import { supabase } from '../supabase';
import { FoodItem } from '../types';

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

export const searchService = {
  // Better AI suggestions with intent prediction
  async getAiSuggestions(searchTerm: string, items: FoodItem[]): Promise<string[]> {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    try {
      const menuReference = items.map(i => ({ name: i.name, category: i.category, tags: i.tags })).slice(0, 60);
      
      const response = await fetch('/api/butler/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    try {
      // Get a broad set of items to give the AI context
      const relevantItems = items.filter(i => i.available !== false).slice(0, 100).map(i => ({
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, items: relevantItems })
      });

      if (!response.ok) {
        let errorBody = "";
        try {
          errorBody = await response.text();
        } catch (e) {
          errorBody = "Could not read error response";
        }
        console.error(`[Butler API Error] Status: ${response.status}, Body: ${errorBody}`);
        return null;
      }
      
      const recommendation = await response.json();
      console.log('[Butler Rec] AI Success Payload:', recommendation);
      
      if (!recommendation || !recommendation.bestMatchId) return null;

      // Verify item exists - force string comparison
      const validItem = items.find(i => String(i.id) === String(recommendation.bestMatchId));
      if (!validItem) {
        console.warn(`[Butler Rec] Recommended ID ${recommendation.bestMatchId} not found in current items list`);
        return null;
      }

      return recommendation;
    } catch (error) {
      console.error('Smart Rec Error:', error);
      return null;
    }
  },

  // Record a search for analytics
  async logSearch(searchTerm: string, userId: string = 'anonymous') {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) return;
    try {
      await supabase.from('search_history').insert({ query: trimmed, user_id: userId });
      
      const { data: existing } = await supabase.from('search_analytics').select('*').eq('query', trimmed).single();
      if (existing) {
        await supabase.from('search_analytics').update({ 
          count: (existing.count || 0) + 1,
          last_searched: new Date().toISOString()
        }).eq('query', trimmed);
      } else {
        await supabase.from('search_analytics').insert({
          query: trimmed,
          count: 1,
          last_searched: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Logging Search Error:', error);
    }
  },

  // Get trending searches
  async getTrendingSearches(limitCount: number = 6): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('search_analytics')
        .select('query')
        .order('count', { ascending: false })
        .limit(limitCount);

      if (error) {
        if (error.code === 'PGRST204' || error.code === '42P01') {
          return ['Anniversary Cakes', 'Chocolate Truffle', 'Coffee Pastries', 'Custom Gifts'];
        }
        throw error;
      }
      return data.length > 0 ? data.map(item => item.query) : ['Anniversary Cakes', 'Chocolate Truffle', 'Coffee Pastries', 'Custom Gifts'];
    } catch (error) {
      console.error('Fetching Trending Error:', error);
      return ['Anniversary Cakes', 'Chocolate Truffle', 'Coffee Pastries', 'Custom Gifts'];
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

