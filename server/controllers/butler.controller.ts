import { Request, Response } from "express";
import * as recommendationService from "../services/recommendation.service";

export async function getRecommendation(req: Request, res: Response) {
  const { query, items } = req.body;
  try {
    const result = await recommendationService.getSmartRecommendation(query, items || []);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Recommendation failed", details: error.message });
  }
}

export async function getSuggestions(req: Request, res: Response) {
  const { searchTerm, items } = req.body;
  try {
    const result = await recommendationService.getSearchSuggestions(searchTerm, items || []);
    res.json({ suggestions: result });
  } catch (error: any) {
    res.status(500).json({ error: "Suggestions failed", details: error.message });
  }
}
