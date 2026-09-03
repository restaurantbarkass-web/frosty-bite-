import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

export function getGenAI() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required for AI operations');
    }
    genAI = new GoogleGenAI({ 
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'frosty-bite-app',
        }
      }
    });
  }
  return genAI;
}

export function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}
