import { Router } from "express";
import * as butlerController from "../controllers/butler.controller";

const router = Router();

router.post("/recommend", butlerController.getRecommendation);
router.post("/suggestions", butlerController.getSuggestions);

export default router;
