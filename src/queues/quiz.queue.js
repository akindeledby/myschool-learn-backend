import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

// 📦 Quiz Queue
export const quizQueue = new Queue("quiz", {
  connection: redis,

  defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,

      attempts: 3,

  backoff: {
    type: "exponential",
    delay: 5000,
    },
  }
});