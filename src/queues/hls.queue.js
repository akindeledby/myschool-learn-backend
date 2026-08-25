import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

// 📦 hls Queue
export const hlsQueue = new Queue("hls", {
  connection: redis,

  defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,
    },
});