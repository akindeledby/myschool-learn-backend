import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

// 📦 Image Queue
export const imageQueue = new Queue("image", {
  connection: redis,

  defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,
    },
});