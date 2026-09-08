import { getGenAI, cleanJsonResponse } from "../ai/gemini";

export interface ButlerRecommendation {
  bestMatchId: string | null;
  reason: string;
  intent: string;
  alternatives: string[];
  isEmotionalMatch: boolean;
  occasionDetected: string;
  moodDetected: string;
  recommendationType: string;
  butlerResponse: string;
}

// In-memory caches to secure free-tier API quota
const recCache = new Map<string, ButlerRecommendation>();
const sugCache = new Map<string, string[]>();

let quotaExhaustedUntil = 0;

const SEEDED_RECOMMENDATIONS: Record<string, ButlerRecommendation> = {
  "recommend a masterpiece for a luxury treat": {
    bestMatchId: "7",
    reason: "Pure dark chocolate fudge decadent bento masterpiece.",
    intent: "Luxury Indulgence",
    alternatives: ["1", "6"],
    isEmotionalMatch: true,
    occasionDetected: "Luxury Treat",
    moodDetected: "Decadent",
    recommendationType: "trending",
    butlerResponse: "The Chocolate Truffle Bento is an absolute masterpiece of cocoa. Our master bakers hand-craft each cake using single-origin Belgian dark chocolate, creating an experience of pure luxury."
  },
  "best celebratory dessert for a premium member": {
    bestMatchId: "1",
    reason: "Elegant, satin crimson silk red velvet masterpiece.",
    intent: "Gala Celebration",
    alternatives: ["7", "6"],
    isEmotionalMatch: true,
    occasionDetected: "Member Milestone",
    moodDetected: "Celebratory",
    recommendationType: "occasion",
    butlerResponse: "To celebrate your esteemed membership, I highly recommend our signature Red Velvet Cake. Its smooth crimson layers and rich cream cheese frosting create the ultimate celebratory tasting."
  }
};

const SEEDED_SUGGESTIONS: Record<string, string[]> = {
  "recommend a masterpiece for a luxury treat": ["Chocolate Truffle Bento", "Red Velvet Cake", "Strawberry Bento Cake"],
  "best celebratory dessert for a premium member": ["Red Velvet Cake", "Chocolate Truffle Bento", "Strawberry Bento Cake"],
  "chocolate": ["Chocolate Truffle Bento", "Choco Chip Cookie", "Belgian Hot Chocolate"],
  "cake": ["Red Velvet Cake", "Strawberry Bento Cake", "Chocolate Truffle Bento"],
  "pastry": ["Butter Croissant"],
  "bento": ["Strawberry Bento Cake", "Chocolate Truffle Bento"],
  "strawberry": ["Strawberry Bento Cake"]
};

function getNormalizedKey(query: string): string {
  return query.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

function getLocalRecommendation(query: string, items: any[]): ButlerRecommendation {
  const norm = query.toLowerCase();
  const hasItems = Array.isArray(items) && items.length > 0;
  
  // Find appropriate items by semantic matching
  let matchedItems = [];
  if (hasItems) {
    if (norm.includes("chocolate") || norm.includes("fudge") || norm.includes("cocoa") || norm.includes("dark")) {
      matchedItems = items.filter(i => 
        (i.name && i.name.toLowerCase().includes("chocolate")) || 
        (i.description && i.description.toLowerCase().includes("chocolate")) ||
        (i.name && i.name.toLowerCase().includes("fudge"))
      );
    } else if (norm.includes("fruit") || norm.includes("berry") || norm.includes("berries") || norm.includes("mango") || norm.includes("strawberry") || norm.includes("lemon") || norm.includes("cherry")) {
      matchedItems = items.filter(i => 
        (i.name && /fruit|berry|berries|mango|strawberry|lemon|cherry/i.test(i.name)) ||
        (i.description && /fruit|berry|berries|mango|strawberry|lemon|cherry/i.test(i.description))
      );
    } else if (norm.includes("celebrat") || norm.includes("birthday") || norm.includes("anniversary") || norm.includes("party") || norm.includes("cake")) {
      matchedItems = items.filter(i => 
        (i.name && /cake|celebration|birthday/i.test(i.name)) ||
        (i.category && /cake/i.test(i.category))
      );
    } else if (norm.includes("croissant") || norm.includes("pastry") || norm.includes("bread") || norm.includes("danish") || norm.includes("puff")) {
      matchedItems = items.filter(i => 
        (i.name && /croissant|pastry|danish|bread|puff/i.test(i.name)) ||
        (i.category && /pastry|bakery/i.test(i.category))
      );
    }
  }

  // Fallback to top items if no matches
  if (matchedItems.length === 0 && hasItems) {
    matchedItems = items;
  }

  const firstItem = matchedItems[0] || null;
  const secondItem = matchedItems[1] || items[0] || null;
  const thirdItem = matchedItems[2] || items[1] || null;

  // Curate response text depending on query
  let reason = "Our most coveted marquee selection.";
  let intent = "Signature Tasting";
  let mood = "Refined";
  let type = "trending";
  let occasion = "Special Moment";
  let responseText = "I have curated our finest selections based on your unique query. These choices represent the absolute pinnacle of our artisan chefs' craft.";

  if (norm.includes("chocolate") || norm.includes("fudge") || norm.includes("cocoa") || norm.includes("dark")) {
    reason = "Pure cacao opulence on a plate.";
    intent = "Cocoa Indulgence";
    mood = "Decadent";
    type = "flavor";
    occasion = "Indulgence";
    responseText = "For the true chocolate connoisseur, this creation features rich, velvety single-origin chocolates layered in harmony.";
  } else if (norm.includes("fruit") || norm.includes("berry") || norm.includes("berries") || norm.includes("mango") || norm.includes("strawberry") || norm.includes("lemon")) {
    reason = "A refreshing symphony of fresh fruit.";
    intent = "Summer Fruit Tasting";
    mood = "Vibrant";
    type = "flavor";
    occasion = "Refined Escape";
    responseText = "A glorious, balanced display of fresh seasonal fruits nestled in delicate artisanal cream and flaky layers.";
  } else if (norm.includes("celebrat") || norm.includes("birthday") || norm.includes("anniversary") || norm.includes("party") || norm.includes("cake")) {
    reason = "The majestic center of your celebration.";
    intent = "Gala Celebration";
    mood = "Festive";
    type = "occasion";
    occasion = "Celebration";
    responseText = "An exquisite, show-stopping cake designed with intricate details to elevate your beautiful lifetime milestones.";
  } else if (norm.includes("croissant") || norm.includes("pastry") || norm.includes("bread") || norm.includes("danish")) {
    reason = "Golden, hand-laminated buttery perfection.";
    intent = "Pastry Ritual";
    mood = "Cozy & Warm";
    type = "trending";
    occasion = "Gourmet Breakfast";
    responseText = "Layers of premium French butter baked to a golden shatteringly light crisp. Simply a poetic morning ritual.";
  }

  return {
    bestMatchId: firstItem ? String(firstItem.id) : null,
    reason,
    intent,
    alternatives: secondItem && thirdItem && String(secondItem.id) !== String(firstItem?.id) ? [String(secondItem.id), String(thirdItem.id)] : [],
    isEmotionalMatch: true,
    occasionDetected: occasion,
    moodDetected: mood,
    recommendationType: type,
    butlerResponse: responseText
  };
}

function getLocalSuggestions(searchTerm: string, items: any[]): string[] {
  const norm = searchTerm.toLowerCase().trim();
  const suggestions: string[] = [];
  
  if (Array.isArray(items) && items.length > 0) {
    const matches = items.filter(i => 
      i.name && (i.name.toLowerCase().includes(norm) || (i.category && i.category.toLowerCase().includes(norm)))
    );
    matches.slice(0, 5).forEach(m => suggestions.push(m.name));
  }
  
  const defaults = ["Red Velvet Cake", "Butter Croissant", "Strawberry Bento Cake", "Chocolate Truffle Bento", "Belgian Hot Chocolate"];
  for (const d of defaults) {
    if (suggestions.length >= 5) break;
    if (!suggestions.includes(d)) {
      suggestions.push(d);
    }
  }
  
  return suggestions.slice(0, 5);
}

export async function getSmartRecommendation(query: string, items: any[]): Promise<ButlerRecommendation> {
  const cacheKey = getNormalizedKey(query);
  
  // 1. Resolve from seeded values if available
  if (SEEDED_RECOMMENDATIONS[cacheKey]) {
    console.log(`[RecommendationCache] Serving seeded recommendation for: "${cacheKey}"`);
    return SEEDED_RECOMMENDATIONS[cacheKey];
  }

  // 2. Resolve from cache if available
  if (recCache.has(cacheKey)) {
    console.log(`[RecommendationCache] Serving cached recommendation for: "${cacheKey}"`);
    return recCache.get(cacheKey)!;
  }

  // 2. Check if we are in active cooldown
  if (Date.now() < quotaExhaustedUntil) {
    console.log('[RecommendationService] Active cooldown: using local matching engine.');
    return getLocalRecommendation(query, items);
  }

  try {
    const genAI = getGenAI();
    
    const prompt = `
      User Search Query: "${query}"
      Available Menu Items (IDs are strings): ${items && items.length > 0 ? JSON.stringify(items) : "No direct menu provided."}
   
      Task: Act as the "Frosty Bite Butler", a premium dessert concierge.
      Analyze the search for intent, occasion, and emotional fit.
   
      IMPORTANT: ONLY respond with valid JSON. Do not include markdown code blocks.
      
      {
        "bestMatchId": "string-id-or-null",
        "reason": "Dramatic phrase (max 8 words)",
        "intent": "Occasion detected",
        "alternatives": ["id1", "id2"],
        "isEmotionalMatch": true,
        "occasionDetected": "e.g. Birthday",
        "moodDetected": "e.g. Celebratory",
        "recommendationType": "one of: occasion, flavor, budget, trending, standard",
        "butlerResponse": "1-2 sophisticated sentences."
      }
    `;

    let aiResponse: any;
    try {
      console.log(`[RecommendationService] Calling Gemini (gemini-2.5-flash) for: "${query.substring(0, 50)}..."`);
      aiResponse = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are the Frosty Bite Butler. You provide luxury recommendations for premium cakes and pastries. You focus on emotions and matching the perfect treat to the user's specific life moments.",
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      });
    } catch (error: any) {
      const errorStr = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' ? JSON.stringify(error) : String(error));
      
      const isTransientOrQuota = 
        errorStr.includes('503') || 
        errorStr.includes('UNAVAILABLE') || 
        errorStr.includes('demand') ||
        errorStr.includes('429') || 
        errorStr.includes('RESOURCE_EXHAUSTED') || 
        errorStr.includes('quota') ||
        errorStr.includes('Quota exceeded') ||
        String(error).includes('429') ||
        (error && typeof error === 'object' && (error.status === 429 || error.statusCode === 429));

      if (isTransientOrQuota) {
        console.log(`[RecommendationService] Cooldown triggered. Primary model quota limit reached. Using local match fallback.`);
        quotaExhaustedUntil = Date.now() + 15 * 60 * 1000; // 15 minutes of quiet cooldown
      } else {
        console.log(`[RecommendationService] Fallback activated: parsing query locally.`);
      }
      return getLocalRecommendation(query, items);
    }

    const output = cleanJsonResponse(aiResponse.text || '');
    if (!output) {
      throw new Error("Empty response from AI");
    }
    
    const data = JSON.parse(output);
    const result: ButlerRecommendation = {
      bestMatchId: data.bestMatchId ? String(data.bestMatchId) : null,
      reason: data.reason || "A choice of absolute distinction.",
      intent: data.intent || "Luxury Exploration",
      alternatives: Array.isArray(data.alternatives) ? data.alternatives.map(String) : [],
      isEmotionalMatch: !data.isEmotionalMatch,
      occasionDetected: data.occasionDetected || "Special Moment",
      moodDetected: data.moodDetected || "Refined",
      recommendationType: data.recommendationType || "standard",
      butlerResponse: data.butlerResponse || "I have curated our finest selections based on your unique preferences."
    };

    // Cache the premium result for future identical searches
    recCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    console.log(`[RecommendationService] Note: Using local match fallback:`, err.message || err);
    return getLocalRecommendation(query, items);
  }
}
 
export async function getSearchSuggestions(searchTerm: string, items: any[]): Promise<string[]> {
  const cacheKey = getNormalizedKey(searchTerm);

  // 1. Resolve from seeded values if available
  if (SEEDED_SUGGESTIONS[cacheKey]) {
    return SEEDED_SUGGESTIONS[cacheKey];
  }

  // 2. Resolve from cache if available
  if (sugCache.has(cacheKey)) {
    console.log(`[SuggestionsCache] Serving cached suggestions for: "${cacheKey}"`);
    return sugCache.get(cacheKey)!;
  }

  // 2. Check if we are in active cooldown
  if (Date.now() < quotaExhaustedUntil) {
    return getLocalSuggestions(searchTerm, items);
  }

  try {
    const genAI = getGenAI();
    
    const prompt = `
      Search Term: "${searchTerm}"
      Available Menu Context: ${items && items.length > 0 ? JSON.stringify(items.slice(0, 20)) : "Bakery and cakes"}
      Predict 5 natural, high-intent search phrases for this premium bakery.
      Respond ONLY with a JSON object: { "suggestions": ["phrase1", "phrase2", ...] }
    `;
   
    let response: any;
    try {
      response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { 
          systemInstruction: "You are the Frosty Bite Butler suggestions engine.",
          responseMimeType: "application/json" 
        }
      });
    } catch (err: any) {
      const errorStr = err instanceof Error 
        ? err.message 
        : (err && typeof err === 'object' ? JSON.stringify(err) : String(err));
      
      const isTransientOrQuota = 
        errorStr.includes('503') || 
        errorStr.includes('UNAVAILABLE') || 
        errorStr.includes('demand') ||
        errorStr.includes('429') || 
        errorStr.includes('RESOURCE_EXHAUSTED') || 
        errorStr.includes('quota') ||
        errorStr.includes('Quota exceeded') ||
        String(err).includes('429') ||
        (err && typeof err === 'object' && (err.status === 429 || err.statusCode === 429));

      if (isTransientOrQuota) {
        console.log(`[RecommendationService] Suggestions engine cooldown triggered due to quota limit.`);
        quotaExhaustedUntil = Date.now() + 15 * 60 * 1000;
      } else {
        console.log(`[RecommendationService] Suggestions engine primary model fallback activated.`);
      }
      return getLocalSuggestions(searchTerm, items);
    }

    const output = cleanJsonResponse(response.text || '');
    if (!output) return getLocalSuggestions(searchTerm, items);
    const data = JSON.parse(output);
    const resultList = data.suggestions || getLocalSuggestions(searchTerm, items);
    
    // Cache suggestions
    sugCache.set(cacheKey, resultList);
    return resultList;
  } catch (err: any) {
    console.log(`[RecommendationService] Note: Suggestions pipeline match:`, err.message || err);
    return getLocalSuggestions(searchTerm, items);
  }
}
