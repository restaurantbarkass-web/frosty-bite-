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

let quotaExhaustedUntil = 0;

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

  // Curate gourmet response text depending on query
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
    bestMatchId: firstItem ? firstItem.id : null,
    reason,
    intent,
    alternatives: secondItem && thirdItem && secondItem.id !== firstItem?.id ? [secondItem.id, thirdItem.id] : [],
    isEmotionalMatch: true,
    occasionDetected: occasion,
    moodDetected: mood,
    recommendationType: type,
    butlerResponse: responseText
  };
}

export async function getSmartRecommendation(query: string, items: any[]): Promise<ButlerRecommendation> {
  // Check if we are in rapid 429 quota bypass cooldown
  if (Date.now() < quotaExhaustedUntil) {
    console.log('[RecommendationService] Safe rate-limiting bypass: using local semantic matching engine.');
    return getLocalRecommendation(query, items);
  }

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
    console.log(`[RecommendationService] Calling Gemini (gemini-flash-latest) for: "${query.substring(0, 50)}..."`);
    aiResponse = await genAI.models.generateContent({
      model: "gemini-flash-latest",
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
      errorStr.includes('Quota exceeded');

    if (isTransientOrQuota) {
      console.warn(`[RecommendationService] Primary model (gemini-flash-latest) returned transient/quota status: ${errorStr}. Falling back to gemini-3.5-flash...`);
      try {
        aiResponse = await genAI.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction: "You are the Frosty Bite Butler. You provide luxury recommendations for premium cakes and pastries. You focus on emotions and matching the perfect treat to the user's specific life moments.",
            responseMimeType: "application/json",
            temperature: 0.1,
          }
        });
      } catch (fallbackError: any) {
        const fbErrorStr = fallbackError instanceof Error 
          ? fallbackError.message 
          : (fallbackError && typeof fallbackError === 'object' ? JSON.stringify(fallbackError) : String(fallbackError));
        console.warn(`[RecommendationService] Fallback model (gemini-3.5-flash) also failed: ${fbErrorStr}`);
        quotaExhaustedUntil = Date.now() + 3 * 60 * 1000;
        return getLocalRecommendation(query, items);
      }
    } else {
      console.warn(`[RecommendationService] Generation failed with non-quota/transient error: ${errorStr}`);
      return getLocalRecommendation(query, items);
    }
  }

  try {
    const output = cleanJsonResponse(aiResponse.text || '');
    if (!output) {
      throw new Error("Empty response from AI");
    }
    
    const data = JSON.parse(output);
 
    return {
      bestMatchId: data.bestMatchId || null,
      reason: data.reason || "A choice of absolute distinction.",
      intent: data.intent || "Luxury Exploration",
      alternatives: data.alternatives || [],
      isEmotionalMatch: !!data.isEmotionalMatch,
      occasionDetected: data.occasionDetected || "Special Moment",
      moodDetected: data.moodDetected || "Refined",
      recommendationType: data.recommendationType || "standard",
      butlerResponse: data.butlerResponse || "I have curated our finest selections based on your unique preferences."
    };
  } catch (parseError: any) {
    console.warn(`[RecommendationService] Failed to parse generated content: ${parseError.message}`);
    return getLocalRecommendation(query, items);
  }
}
 
export async function getSearchSuggestions(searchTerm: string, items: any[]): Promise<string[]> {
  if (Date.now() < quotaExhaustedUntil) {
    // Return curated static list
    return ["Birthday cakes", "Artisan croissants", "Chocolate truffles", "Custom pastries", "Best desserts"];
  }

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
      model: "gemini-flash-latest",
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
      errorStr.includes('Quota exceeded');

    if (isTransientOrQuota) {
      console.warn(`[RecommendationService] Suggestions engine primary model (gemini-flash-latest) returned transient/quota status: ${errorStr}. Falling back to gemini-3.5-flash...`);
      try {
        response = await genAI.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: { 
            systemInstruction: "You are the Frosty Bite Butler suggestions engine.",
            responseMimeType: "application/json" 
          }
        });
      } catch (fallbackError: any) {
        const fbErrorStr = fallbackError instanceof Error 
          ? fallbackError.message 
          : (fallbackError && typeof fallbackError === 'object' ? JSON.stringify(fallbackError) : String(fallbackError));
        console.warn(`[RecommendationService] Suggestions engine fallback also failed: ${fbErrorStr}`);
        quotaExhaustedUntil = Date.now() + 3 * 60 * 1000;
        return ["Birthday cakes", "Artisan croissants", "Chocolate truffles", "Custom pastries", "Best desserts"];
      }
    } else {
      console.warn(`[RecommendationService] Suggestions primary call failed with non-quota/transient error: ${errorStr}`);
      return ["Birthday cakes", "Artisan croissants", "Chocolate truffles", "Custom pastries", "Best desserts"];
    }
  }

  try {
    const output = cleanJsonResponse(response.text || '');
    if (!output) return ["Birthday cakes", "Artisan croissants", "Chocolate truffles", "Custom pastries", "Best desserts"];
    const data = JSON.parse(output);
    return data.suggestions || ["Birthday cakes", "Artisan croissants", "Chocolate truffles", "Custom pastries", "Best desserts"];
  } catch (err: any) {
    console.warn(`[RecommendationService] Parsing suggestions failed: ${err.message}`);
    return ["Birthday cakes", "Artisan croissants", "Chocolate truffles", "Custom pastries", "Best desserts"];
  }
}
