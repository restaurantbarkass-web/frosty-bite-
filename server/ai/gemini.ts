import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

export function getGenAI() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || 'AIzaSyAnIXi3-5HUErmcW4VL6Og03hF9PD4wsdo';
    genAI = new GoogleGenAI({ 
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
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
