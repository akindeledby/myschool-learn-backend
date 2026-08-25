import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

// 📦 Lesson Queue
export const lessonQueue = new Queue("lesson", {
  connection: redis,

  defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,
    },
});