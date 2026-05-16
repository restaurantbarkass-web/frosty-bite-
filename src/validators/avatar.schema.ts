import { z } from "zod";

export const avatarSchema = z.object({
  prompt: z.string().min(2).max(300),
  vibe: z.string().max(50).optional(),
  imageUrl: z.string().url().optional(),
  userId: z.string().optional(),
});

export type AvatarRequest = z.infer<typeof avatarSchema>;
