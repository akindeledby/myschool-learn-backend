import "dotenv/config";
import { Worker } from "bullmq";
import { GetJobCommand } from "@aws-sdk/client-mediaconvert";
import { db } from "../../lib/db.js";
import { mediaConvert } from "../lib/mediaconvert.js";

import {
  mediaConvertStatusQueue,
} from "../queues/mediaconvert-status.queue.js";
import { createRedisConnection } from "../../lib/redis.js";

const bucketName =
  process.env.REMOTION_AWS_BUCKET_NAME;

const region =
  process.env.AWS_REGION;

if (!bucketName) {
  throw new Error(
    "REMOTION_AWS_BUCKET_NAME missing"
  );
}

if (!region) {
  throw new Error(
    "AWS_REGION missing"
  );
}

export const mediaConvertStatusWorker =
  new Worker(
    "mediaconvert-status",

    async (job) => {
      const {
        topicId,
        mediaConvertJobId,
      } = job.data;

      try {
        console.log(
          `🔍 Checking MediaConvert job ${mediaConvertJobId}`
        );

        const response =
          await mediaConvert.send(
            new GetJobCommand({
              Id: mediaConvertJobId,
            })
          );

        const status =
          response.Job?.Status;

        console.log(
          "📊 MediaConvert Status:",
          status
        );

        // ============================
        // FAILED
        // ============================

        if (
          status === "ERROR" ||
          status === "CANCELED"
        ) {
          console.error(
            "❌ MediaConvert job failed"
          );

          console.error(
            response.Job
          );

          await db.topic.update({
            where: {
              id: topicId,
            },

            data: {
              status: "FAILED",

              currentStage:
                "HLS_FAILED",
            },
          });

          return {
            success: false,
            topicId,
          };
        }

        // ============================
        // COMPLETE
        // ============================

        if (
          status === "COMPLETE"
        ) {
          const hlsUrl =
            `https://${bucketName}.s3.${region}.amazonaws.com/hls/${topicId}/out.m3u8`;

          await db.topic.update({
            where: {
              id: topicId,
            },

            data: {
              status: "COMPLETED",
              currentStage: "COMPLETED",
              progress: 100,
              hlsUrl,
            },
          });

          console.log(
            "✅ MediaConvert completed"
          );

          console.log(
            "🎞 HLS URL:",
            hlsUrl
          );

          return {
            success: true,

            topicId,

            hlsUrl,
          };
        }

        // ============================
        // STILL PROCESSING
        // ============================

        console.log(
          "⏳ MediaConvert still processing"
        );

        await db.topic.update({
          where: {
            id: topicId,
          },

          data: {
            currentStage:
              "GENERATING_HLS",

            progress: 85,
          },
        });

        await mediaConvertStatusQueue.add(
          "check-mediaconvert-status",

          {
            topicId,

            mediaConvertJobId,
          },

          {
            delay: 15000,

            removeOnComplete: 20,

            removeOnFail: 50,
          }
        );

        return {
          success: true,

          topicId,

          status,
        };
      } catch (error) {
        console.error(
          "❌ MediaConvert status worker failed"
        );

        console.error(error);

        throw error;
      }
    },

    {
      connection: createRedisConnection(),

      concurrency: 1,

      lockDuration:
        1000 * 60 * 10,

      stalledInterval:
        1000 * 30,

      maxStalledCount: 3,
    }
  );

// ============================
// EVENTS
// ============================

mediaConvertStatusWorker.on(
  "ready",

  () => {
    console.log(
      "✅ MediaConvert status worker connected"
    );
  }
);

mediaConvertStatusWorker.on(
  "active",

  (job) => {
    console.log(
      `⚙️ MediaConvert status job active: ${job.id}`
    );
  }
);

mediaConvertStatusWorker.on(
  "completed",

  (job) => {
    console.log(
      `🎯 MediaConvert status job completed: ${job.id}`
    );
  }
);

mediaConvertStatusWorker.on(
  "failed",

  (job, err) => {
    console.error(
      `❌ MediaConvert status job failed: ${job?.id}`
    );

    console.error(err);
  }
);

mediaConvertStatusWorker.on(
  "error",

  (err) => {
    console.error(
      "❌ MediaConvert status worker error:"
    );

    console.error(err);
  }
);

// ============================
// SHUTDOWN
// ============================

process.on(
  "SIGINT",

  async () => {
    console.log(
      "Closing MediaConvert status worker..."
    );

    await mediaConvertStatusWorker.close();

    process.exit(0);
  }
);