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
  // AI-powered smart suggestions strictly based on in-stock menu items
  async getAiSuggestions(searchTerm: string, items: FoodItem[]): Promise<string[]> {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    try {
      const menuReference = items.map(i => ({ name: i.name, category: i.category })).slice(0, 50);
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          Search Term: "${searchTerm}"
          Menu Reference: ${JSON.stringify(menuReference)}

          As a bakery AI assistant, provide 5 search suggestions that strictly relate to products we actually have in our menu reference above. 
          Respond ONLY with a list of suggestions separated by newlines. 
          Do not suggest anything not present or highly similar to the items in the menu reference.
        `
      });
      
      const output = response.text || '';
      const suggestions = output.split('\n').filter(s => s.trim().length > 0).slice(0, 5);
      
      // Grounding: Ensure suggestions are relevant to items we actually have
      const menuKeywords = items.flatMap(i => [
        i.name.toLowerCase(), 
        i.category.toLowerCase(),
        ...(i.tags || []).map(t => t.toLowerCase())
      ]);

      return suggestions.filter(s => {
        const suggestionLower = s.toLowerCase();
        return menuKeywords.some(keyword => 
          keyword.includes(suggestionLower) || suggestionLower.includes(keyword)
        );
      });
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
        const id = item.id.toLowerCase();
        const barcode = (item.barcode || '').toLowerCase();

        // ID & Barcode match (highest priority for scanning)
        if (id === query || (barcode && barcode === query)) score += 200;
        else if (id.includes(query) || (barcode && barcode.includes(query))) score += 40;

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
  },

  // Deep AI Recommendation Engine
  async getSmartRecommendation(query: string, items: FoodItem[]) {
    if (!query || query.length < 3) return null;

    try {
      const simplifiedItems = items.map(i => ({
        id: i.id,
        name: i.name,
        category: i.category,
        description: i.description,
        price: i.price,
        tags: i.tags
      }));

      const response = await ai.models.generateContent({ 
        model: "gemini-3-flash-preview",
        contents: `
          User Search: "${query}"
          Menu Data: ${JSON.stringify(simplifiedItems)}

          Analyze the search intent (occasion, mood, budget, flavor) and return a JSON response.
          CRITICAL: You MUST ONLY suggest product IDs that are present in the 'Menu Data' provided above. Do not hallucinate or suggest IDs that don't exist in the data.
          
          {
            "bestMatchId": "id-of-the-product",
            "reason": "Personalized human-like explanation (max 120 chars)",
            "intent": "Occasion/Mood detected",
            "alternatives": ["id1", "id2"],
            "isEmotionalMatch": true/false
          }
          If no good match from the provided Menu Data, return null. Return ONLY JSON.
        `,
        config: {
          systemInstruction: "You are the 'Frosty Bite Butler', a luxury bakery concierge. Your goal is to find the perfect match for a user's request from the menu.",
          responseMimeType: "application/json"
        }
      });

      const resultText = response.text || '';
      try {
        const cleaned = resultText.replace(/```json|```/g, '').trim();
        const recommendation = JSON.parse(cleaned);

        if (!recommendation) return null;

        // Validation: Ensure the best match exists in our local menu
        const validItem = items.find(i => i.id === recommendation.bestMatchId);
        if (!validItem) {
          console.warn('AI suggested a non-existent product ID:', recommendation.bestMatchId);
          return null;
        }

        // Integrity: Filter out any alternative IDs that don't exist
        if (recommendation.alternatives) {
          recommendation.alternatives = recommendation.alternatives.filter((id: string) => 
            items.some(i => i.id === id)
          );
        }

        return recommendation;
      } catch (e) {
        return null;
      }
    } catch (error) {
      console.error('Smart Rec Error:', error);
      return null;
    }
  }
};
