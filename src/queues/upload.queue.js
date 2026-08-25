import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

// 📦 upload Queue
export const uploadQueue = new Queue("upload", {
  connection: redis,

  defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,
    },
});