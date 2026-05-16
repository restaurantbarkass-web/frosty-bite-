import { Request, Response } from "express";
import { generateAvatarImage } from "../services/avatar.service";

export async function generateAvatar(req: Request, res: Response) {
  const { prompt, vibe, imageUrl, userId } = req.body;
  console.log(`[Avatar Controller] Generating avatar for user: ${userId}`);

  try {
    const imageUrlResult = await generateAvatarImage({ prompt, vibe, imageUrl, userId });
    
    res.status(200).json({ 
      status: "completed", 
      url: imageUrlResult 
    });
  } catch (error: any) {
    console.error("[Avatar Controller] Generation Error:", error);
    res.status(500).json({ error: "Failed to generate avatar", details: error.message });
  }
}
