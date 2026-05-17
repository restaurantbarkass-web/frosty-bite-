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

export async function getSmartRecommendation(query: string, items: any[]): Promise<ButlerRecommendation> {
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

  let response;
  try {
    console.log(`[RecommendationService] Calling Gemini for: "${query.substring(0, 50)}..."`);
    response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are the Frosty Bite Butler. You provide luxury recommendations for premium cakes and pastries. You focus on emotions and matching the perfect treat to the user's specific life moments.",
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });
  } catch (error: any) {
    console.warn(`[RecommendationService] Primary model failed, trying fallback: ${error.message}`);
    // Using flash lite as fallback
    try {
      response = await genAI.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: { 
          systemInstruction: "You are the Frosty Bite Butler. Respond with valid JSON only.",
          temperature: 0.2 
        }
      });
    } catch (fallbackError: any) {
      console.error(`[RecommendationService] Fallback also failed:`, fallbackError);
      throw new Error(`AI generation failed: ${fallbackError.message}`);
    }
  }

  const output = cleanJsonResponse(response.text || '');
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
}

export async function getSearchSuggestions(searchTerm: string, items: any[]): Promise<string[]> {
  const genAI = getGenAI();
  
  const prompt = `
    Search Term: "${searchTerm}"
    Available Menu Context: ${items && items.length > 0 ? JSON.stringify(items.slice(0, 20)) : "Bakery and cakes"}
    Predict 5 natural, high-intent search phrases for this premium bakery.
    Respond ONLY with a JSON object: { "suggestions": ["phrase1", "phrase2", ...] }
  `;

  const response = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { 
      systemInstruction: "You are the Frosty Bite Butler suggestions engine.",
      responseMimeType: "application/json" 
    }
  });

  const output = cleanJsonResponse(response.text || '');
  if (!output) return [];
  const data = JSON.parse(output);
  return data.suggestions || [];
}
