import { Request, Response } from "express";
import * as recommendationService from "../services/recommendation.service";

export async function recommend(req: Request, res: Response) {
  const { query, items } = req.body;
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: "Invalid query" });
  }

  try {
    const recommendation = await recommendationService.getSmartRecommendation(query, items);
    res.json(recommendation);
  } catch (error: any) {
    console.error("[Butler Controller] Recommendation failed:", error);
    res.status(500).json({ error: "Butler service unavailable", details: error.message });
  }
}

export async function suggestions(req: Request, res: Response) {
  const { searchTerm, items } = req.body;
  if (!searchTerm || searchTerm.trim().length < 2) {
    return res.status(400).json({ error: "Invalid search term" });
  }

  try {
    const suggestions = await recommendationService.getSearchSuggestions(searchTerm, items);
    res.json({ suggestions });
  } catch (error: any) {
    console.error("[Butler Controller] Suggestions failed:", error);
    // Graceful fallback
    res.json({ suggestions: ["Chocolate Truffle Cake", "Pastries", "Cakes"] });
  }
}
