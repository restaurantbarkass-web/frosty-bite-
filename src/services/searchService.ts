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
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          Search Term: "${searchTerm}"
          Menu Reference: ${JSON.stringify(menuReference)}

          As a bakery AI concierge, predict the user's intent and provide 5 smart search suggestions.
          Suggestions should be natural, high-intent phrases like "Best velvet cake for anniversary" or "Sweet pastries for evening coffee".
          Respond ONLY with a list of suggestions separated by newlines.
        `
      });
      
      const output = response.text || '';
      return output.split('\n').filter(s => s.trim().length > 0).slice(0, 5);
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

      const response = await ai.models.generateContent({ 
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: [{
            text: `
              User Search: "${query}"
              Menu: ${JSON.stringify(relevantItems)}

              Task: Act as the "Frosty Bite Butler", a premium dessert concierge.
              Analyze the search for:
              - Occasion: (e.g., anniversary, birthday, romantic)
              - Mood: (e.g., celebratory, cozy, luxury)
              - Budget: (Is price mentioned or implied?)
              - Flavor Profile: (Chocolate, fruity, etc.)

              IMPORTANT: If a masterpiece has "is_ai_boosted: true", it should be given slight preference if it matches the general vibe.

              Respond ONLY with a JSON object:
              {
                "bestMatchId": "id-of-item",
                "reason": "Dramatic, punchy reason (max 8 words)",
                "intent": "e.g., Anniversary Celebration",
                "alternatives": ["id1", "id2"],
                "isEmotionalMatch": true/false,
                "occasionDetected": "string",
                "moodDetected": "string",
                "budgetDetected": "string or null",
                "recommendationType": "one of: occasion, flavor, budget, trending, standard",
                "butlerResponse": "A premium, sophisticated greeting and recommendation (2 sentences). Use words like 'exquisite', 'divine', 'perfectly suited'."
              }
            `
          }]
        }],
        config: {
          systemInstruction: "You are the Frosty Bite Butler. You provide luxury recommendations for premium cakes and pastries. You focus on emotions and matching the perfect treat to the user's specific life moments.",
          responseMimeType: "application/json"
        }
      });

      const resultText = response.text || '';
      try {
        const cleaned = resultText.replace(/```json|```/g, '').trim();
        if (!cleaned || cleaned === 'null') return null;
        
        const recommendation = JSON.parse(cleaned) as AiRecommendationResponse;
        if (!recommendation || !recommendation.bestMatchId) return null;

        // Verify item exists
        const validItem = items.find(i => i.id === recommendation.bestMatchId);
        if (!validItem) return null;

        return recommendation;
      } catch (e) {
        console.error('JSON Parse Error in AI Butler:', e);
        return null;
      }
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

