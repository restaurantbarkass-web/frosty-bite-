import { supabase } from '../supabase';
import { GoogleGenAI } from '@google/genai';
import { FoodItem } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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

export const searchService = {
  // AI-powered smart suggestions
  async getAiSuggestions(searchTerm: string): Promise<string[]> {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As a bakery AI assistant for "Frosty Bite", provide 5 short, creative search suggestions based on the term: "${searchTerm}". Only return the suggestions separated by newlines. Examples: "Custom Birthday Cakes", "Eggless Brownies", "Red Velvet Pastries".`
      });
      
      const output = response.text || '';
      return output.split('\n').filter(s => s.trim().length > 0).slice(0, 5);
    } catch (error) {
      console.error('AI Suggestion Error:', error);
      return [];
    }
  },

  // Record a search for analytics
  async logSearch(searchTerm: string, userId: string = 'anonymous') {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) return;

    try {
      // 1. Log search history
      await supabase.from('search_history').insert({
        query: trimmed,
        user_id: userId
      });

      // 2. Update global trending analytics
      // We'll use an upsert pattern with a custom function or RPC if available, 
      // but for simplicity in a typical Supabase setup, we can fetch, then increment.
      // Better: Use a supabase RPC for atomic increment if heavy traffic, 
      // but for now let's use the straightforward upsert approach.
      
      const { data: existing } = await supabase
        .from('search_analytics')
        .select('*')
        .eq('query', trimmed)
        .single();

      if (existing) {
        await supabase
          .from('search_analytics')
          .update({ 
            count: (existing.count || 0) + 1,
            last_searched: new Date().toISOString()
          })
          .eq('query', trimmed);
      } else {
        await supabase
          .from('search_analytics')
          .insert({
            query: trimmed,
            count: 1,
            last_searched: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Logging Search Error:', error);
    }
  },

  // Get trending searches from Supabase
  async getTrendingSearches(limitCount: number = 6): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('search_analytics')
        .select('query')
        .order('count', { ascending: false })
        .limit(limitCount);

      if (error) {
        // If table doesn't exist yet, return defaults instead of crashing
        if (error.code === 'PGRST204' || error.code === '42P01' || error.message.includes('search_analytics')) {
          console.warn('Search tables not found. Please run SQL setup.');
          return ['Cakes', 'Cupcakes', 'Brownies', 'Pastries'];
        }
        throw error;
      }
      return data.map(item => item.query);
    } catch (error) {
      console.error('Fetching Trending Error:', error);
      return ['Cakes', 'Cupcakes', 'Brownies', 'Pastries'];
    }
  },

  // Smart ranking and filtering items
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

        // Exact match (high priority)
        if (name === query) score += 100;
        // Starts with
        else if (name.startsWith(query)) score += 50;
        // Includes in name
        else if (name.includes(query)) score += 20;

        // Category match
        if (category.includes(query)) score += 30;

        // Tags match
        if (tags.some(t => t.includes(query))) score += 25;

        // Description match
        if (description.includes(query)) score += 10;

        return { item, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item);
  }
};
