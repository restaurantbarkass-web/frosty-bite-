import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { AvatarRequest } from "../validators/avatar.schema";
import { generateAvatarImage } from "../services/avatar.service";

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

export const avatarWorker = new Worker(
  "avatar-generation",
  async (job: Job<AvatarRequest>) => {
    const { prompt, vibe, imageUrl, userId } = job.data;
    console.log(`[Worker] Started processing avatar for: ${userId || 'unknown'}`);
    
    try {
      const imageUrlResult = await generateAvatarImage({ prompt, vibe, imageUrl, userId });
      console.log(`[Worker] Successfully generated avatar for ${userId}`);
      return { status: "completed", url: imageUrlResult };
    } catch (error: any) {
      console.error(`[Worker] Generation failed: ${error.message}`);
      throw error;
    }
  },
  { connection }
);

avatarWorker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed!`);
});

avatarWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with ${err.message}`);
});
