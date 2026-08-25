
import { Queue } from "bullmq";
import { redis } from "../../lib/redis.js";

export const audioQueue = new Queue(
  "audio",
  {
    connection: redis,

    defaultJobOptions: {
      removeOnComplete: 20,
      removeOnFail: 50,
    },
  }
);

// import "dotenv/config";

// import { Queue } from "bullmq";
// import IORedis from "ioredis";

// const redisUrl = process.env.REDIS_URL;

// if (!redisUrl) {
//   throw new Error("REDIS_URL is not defined");
// }

// // 🔌 Shared Redis connection (no TLS since your working config uses tls:false)
// export const connection = new IORedis(redisUrl, {
//   maxRetriesPerRequest: null,
//   enableReadyCheck: false,
//   retryStrategy(times) {
//     return Math.min(times * 1000, 10000);
//   },

//   socket: {
//     tls: false,
//     rejectUnauthorized: false,
//   },
// });

// // 📦 Audio Queue
// export const audioQueue = new Queue("audio", {
//   connection,

//   defaultJobOptions: {
//       removeOnComplete: 20,
//       removeOnFail: 50,
//     },
// });