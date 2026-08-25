import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

// 📦 Render Queue
export const videoQueue = new Queue("video", {
  connection: redis,

  defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,
    },
});