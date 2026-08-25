import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

// 📦 Scheme Of Work Queue
export const schemeOfWorkQueue = new Queue("schemeOfWork", {
  connection: redis,

  defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,
    },
});