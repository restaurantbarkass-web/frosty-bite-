import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const getApiKey = () => {
  try {
    return process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  } catch (e) {
    return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callGeminiWithRetry = async (fn: () => Promise<any>, retries = MAX_RETRIES, delay = INITIAL_DELAY): Promise<any> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    const isQuotaError = error.status === 429 || 
                        errorMsg.includes('429') || 
                        errorMsg.includes('RESOURCE_EXHAUSTED') ||
                        errorMsg.includes('quota');

    if (retries > 0 && isQuotaError) {
      // Log as warning instead of error to keep the console clean
      console.warn(`Gemini API quota exceeded. Retrying in ${delay}ms... (${retries} retries left)`);
      await sleep(delay);
      return callGeminiWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const getFoodRecommendations = async (userPreferences: string) => {
  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on these preferences: "${userPreferences}", recommend 3 specific cakes from our bakery menu. Return only the names as a comma-separated list.`,
    }));
    return response.text?.split(',').map((s: string) => s.trim()) || [];
  } catch (error) {
    console.error("Failed to get food recommendations:", error);
    return []; // Return empty list on failure
  }
};

export const getRestaurantInfo = async (location: { lat: number; lng: number }) => {
  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Find the best Frosty Bite or artisan bakeries near my location.",
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: location.lat,
              longitude: location.lng
            }
          }
        }
      },
    }));
    return {
      text: response.text,
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
  } catch (error) {
    console.error("Failed to get restaurant info:", error);
    return { text: "Information temporarily unavailable.", grounding: [] };
  }
};

export const getComplexMealPlan = async (dietaryGoals: string) => {
  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Create a detailed 7-day treat and bread meal plan using Frosty Bite's bakery menu (Cakes, Pastries, Artisan Breads). Goals: ${dietaryGoals}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    }));
    return response.text;
  } catch (error) {
    console.error("Failed to get meal plan:", error);
    return "Meal plan generation is currently unavailable due to high demand. Please try again later.";
  }
};
