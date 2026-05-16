import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

export const avatarQueue = new Queue("avatar-generation", { connection });
