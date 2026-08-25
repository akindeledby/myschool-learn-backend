// import "dotenv/config";
// import IORedis from "ioredis";

// const redisUrl = process.env.REDIS_URL;

// if (!redisUrl) {
//   throw new Error("REDIS_URL is not defined");
// }

// export const redis = new IORedis(redisUrl, {
//   maxRetriesPerRequest: null,
//   enableReadyCheck: false,

//   retryStrategy(times) {
//     return Math.min(times * 1000, 10000);
//   },

//    socket: {
//     tls: false,
//     rejectUnauthorized: false,
//   },
// });

import "dotenv/config";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not defined");
}

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,

  retryStrategy(times) {
    return Math.min(times * 1000, 10000);
  },

   socket: {
    tls: false,
    rejectUnauthorized: false,
  },
});

export const createRedisConnection =
  () =>
    new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });