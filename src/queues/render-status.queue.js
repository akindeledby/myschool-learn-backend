import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

// 📦 Render renderStatus Queue
export const renderStatusQueue = new Queue("status", {
  connection: redis,

  defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,
    },
});