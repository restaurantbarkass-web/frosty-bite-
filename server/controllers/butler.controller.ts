import { Request, Response } from "express";
import * as recommendationService from "../services/recommendation.service";
import * as butlerChatService from "../services/butlerChat.service";

export async function handleChat(req: Request, res: Response) {
  console.log(`[ButlerController] handleChat called with message: "${req.body.message}"`);
  const { message, history, items, customerName } = req.body;
  try {
    const result = await butlerChatService.getButlerChatResponse(
      message,
      history || [],
      items || [],
      customerName
    );
    console.log(`[ButlerController] handleChat success -> action: ${result.action}`);
    res.json(result);
  } catch (error: any) {
    console.error(`[ButlerController] handleChat error:`, error);
    res.status(500).json({ error: "Butler Chat failed", details: error.message });
  }
}

export async function getRecommendation(req: Request, res: Response) {
  console.log(`[ButlerController] getRecommendation called with query: "${req.body.query}"`);
  const { query, items } = req.body;
  try {
    const result = await recommendationService.getSmartRecommendation(query, items || []);
    console.log(`[ButlerController] getRecommendation success`);
    res.json(result);
  } catch (error: any) {
    console.error(`[ButlerController] getRecommendation error:`, error);
    res.status(500).json({ error: "Recommendation failed", details: error.message });
  }
}

export async function getSuggestions(req: Request, res: Response) {
  console.log(`[ButlerController] getSuggestions called with searchTerm: "${req.body.searchTerm}"`);
  const { searchTerm, items } = req.body;
  try {
    const result = await recommendationService.getSearchSuggestions(searchTerm, items || []);
    console.log(`[ButlerController] getSuggestions success`);
    res.json({ suggestions: result });
  } catch (error: any) {
    console.error(`[ButlerController] getSuggestions error:`, error);
    res.status(500).json({ error: "Suggestions failed", details: error.message });
  }
}
