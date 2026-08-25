import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

// 📦 Lesson Queue
export const mediaConvertStatusQueue = new Queue("mediaconvert-status", {
  connection: redis,

  defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,
    },
});

