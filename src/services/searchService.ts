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
      const relevantItems = items.filter(i => i.available).slice(0, 100).map(i => ({
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

      if (!response.ok) throw new Error('Butler API failed');
      const recommendation = await response.json();
      
      if (!recommendation || !recommendation.bestMatchId) return null;

      // Verify item exists
      const validItem = items.find(i => i.id === recommendation.bestMatchId);
      if (!validItem) return null;

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
    const query = searchTerm.toLowerCase().trim();
    if (!query) return [];
    return items
      .map(item => {
        let score = 0;
        const name = item.name.toLowerCase();
        const category = item.category.toLowerCase();
        const description = (item.description || '').toLowerCase();
        const tags = (item.tags || []).map(t => t.toLowerCase());

        if (name === query) score += 100;
        else if (name.startsWith(query)) score += 50;
        else if (name.includes(query)) score += 20;
        if (category.includes(query)) score += 30;
        if (tags.some(t => t.includes(query))) score += 25;
        if (description.includes(query)) score += 10;
        return { item, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);
  }
};

