import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

// 📦 Scene Queue
export const sceneQueue = new Queue("scene", {
  connection: redis,

  defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,
    },
});