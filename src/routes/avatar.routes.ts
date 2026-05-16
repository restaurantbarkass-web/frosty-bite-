import { Router } from "express";
import * as avatarController from "../controllers/avatar.controller";
import { verifyFirebaseToken } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { avatarSchema } from "../validators/avatar.schema";

const router = Router();

router.post("/generate", verifyFirebaseToken, validate(avatarSchema), avatarController.generateAvatar);
router.get("/status/:jobId", avatarController.getJobStatus);

export default router;
