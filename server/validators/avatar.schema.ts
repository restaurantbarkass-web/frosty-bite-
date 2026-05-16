import { z } from "zod";

export const avatarSchema = z.object({
  prompt: z.string().optional(),
  vibe: z.string().optional(),
  imageUrl: z.string().optional(),
  userId: z.string()
});
