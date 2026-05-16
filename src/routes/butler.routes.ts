import { Router } from "express";
import * as butlerController from "../controllers/butler.controller";

const router = Router();

router.post("/recommend", butlerController.recommend);
router.post("/suggestions", butlerController.suggestions);

export default router;
