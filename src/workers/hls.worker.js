import "dotenv/config";

import { Worker } from "bullmq";

import { createRedisConnection } from "../../lib/redis.js";
import { db } from "../../lib/db.js";

import { createHlsJob } from "../services/streaming/mediaconvert.service.js";
import { mediaConvertStatusQueue } from "../queues/mediaconvert-status.queue.js";

// =====================================
// ENV
// =====================================

const bucketName =
  process.env.REMOTION_AWS_BUCKET_NAME;

if (!bucketName) {
  throw new Error(
    "REMOTION_AWS_BUCKET_NAME missing"
  );
}

// =====================================
// HELPERS
// =====================================

function extractS3Key(urlString) {
  const url = new URL(urlString);

  let key = url.pathname.startsWith("/")
    ? url.pathname.slice(1)
    : url.pathname;

  const bucketPrefix =
    `${bucketName}/`;

  if (key.startsWith(bucketPrefix)) {
    key = key.replace(
      bucketPrefix,
      ""
    );
  }

  return key;
}

// =====================================
// HLS WORKER
// =====================================

export const hlsWorker = new Worker(
  "hls",

  async (job) => {
    const { topicId } = job.data;

    try {
      console.log(
        `🎬 HLS job started for topic ${topicId}`
      );

      // =====================================
      // FETCH TOPIC
      // =====================================

      const topic =
        await db.topic.findUnique({
          where: {
            id: topicId,
          },

          select: {
            id: true,
            status: true,
            currentStage: true,
            renderedVideoUrl: true,
            mediaConvertJobId: true,
            hlsUrl: true,
          },
        });

      if (!topic) {
        throw new Error(
          "Topic not found"
        );
      }

      // =====================================
      // ALREADY COMPLETED
      // =====================================

      if (
        topic.status === "COMPLETED"
      ) {
        console.log(
          "✅ Topic already completed. Skipping HLS worker."
        );

        return {
          success: true,
          topicId,
          skipped: true,
          reason:
            "Topic already completed",
        };
      }

      // =====================================
      // HLS ALREADY EXISTS
      // =====================================

      if (topic.hlsUrl) {
        console.log(
          "📦 HLS output already exists. Skipping MediaConvert."
        );

        return {
          success: true,
          topicId,
          skipped: true,
          reason:
            "HLS output already exists",
          hlsUrl: topic.hlsUrl,
        };
      }

      // =====================================
      // MEDIACONVERT JOB ALREADY EXISTS
      // =====================================

      if (
        topic.mediaConvertJobId &&
        topic.currentStage ===
          "GENERATING_HLS"
      ) {
        console.log(
          "📡 MediaConvert job already exists. Skipping duplicate HLS job."
        );

        await mediaConvertStatusQueue.add(
          "check-mediaconvert-status",
          {
            topicId,

            mediaConvertJobId:
              topic.mediaConvertJobId,
          },
          {
            jobId:
              `mediaconvert-status-${topicId}`,

            delay: 15000,

            attempts: 200,

            removeOnComplete: 20,

            removeOnFail: 50,
          }
        );

        return {
          success: true,
          topicId,

          skippedHlsGeneration:
            true,

          mediaConvertJobId:
            topic.mediaConvertJobId,
        };
      }

      // =====================================
      // CHECK RENDERED VIDEO
      // =====================================

      if (!topic.renderedVideoUrl) {
        throw new Error(
          "Missing rendered video URL"
        );
      }

      // =====================================
      // EXTRACT S3 KEY
      // =====================================

      const videoKey =
        extractS3Key(
          topic.renderedVideoUrl
        );

      console.log(
        "📦 Source video:",
        videoKey
      );

      // =====================================
      // UPDATE STATUS
      // =====================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          currentStage:
            "GENERATING_HLS",

          progress: 90,
        },
      });

      await job.updateProgress(90);

      // =====================================
      // CREATE MEDIACONVERT JOB
      // =====================================

      console.log(
        "🚀 Creating MediaConvert HLS job..."
      );

      const mediaConvertJob =
        await createHlsJob({
          inputKey: videoKey,
          topicId,
        });

      if (!mediaConvertJob?.Id) {
        throw new Error(
          "MediaConvert job creation failed"
        );
      }

      console.log(
        "✅ MediaConvert job created:",
        mediaConvertJob.Id
      );

      // =====================================
      // SAVE MEDIACONVERT JOB ID
      // =====================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          currentStage:
            "GENERATING_HLS",

          mediaConvertJobId:
            mediaConvertJob.Id,

          progress: 90,
        },
      });

      // =====================================
      // QUEUE STATUS CHECK
      // =====================================

      await mediaConvertStatusQueue.add(
        "check-mediaconvert-status",
        {
          topicId,

          mediaConvertJobId:
            mediaConvertJob.Id,
        },
        {
          jobId:
            `mediaconvert-status-${topicId}`,

          delay: 15000,

          attempts: 200,

          removeOnComplete: 20,

          removeOnFail: 50,
        }
      );

      console.log(
        "📡 MediaConvert status polling queued"
      );

      // =====================================
      // RETURN
      // =====================================

      return {
        success: true,

        topicId,

        mediaConvertJobId:
          mediaConvertJob.Id,

        nextStage:
          "GENERATING_HLS",
      };

    } catch (error) {
      console.error(
        "❌ HLS worker failed:"
      );

      console.error(error);

      // =====================================
      // MARK FAILED
      // =====================================

      await db.topic.updateMany({
        where: {
          id: topicId,

          status: {
            not: "COMPLETED",
          },
        },

        data: {
          status: "FAILED",

          currentStage:
            "HLS_FAILED",
        },
      });

      throw error;
    }
  },

  {
    connection:
      createRedisConnection(),

    concurrency: 1,

    lockDuration:
      1000 * 60 * 30,

    stalledInterval:
      1000 * 60,

    maxStalledCount: 3,
  }
);

// =====================================
// EVENTS
// =====================================

hlsWorker.on(
  "ready",
  () => {
    console.log(
      "✅ HLS worker connected to Redis"
    );
  }
);

hlsWorker.on(
  "active",
  (job) => {
    console.log(
      `⚙️ HLS job active: ${job.id}`
    );
  }
);

hlsWorker.on(
  "completed",
  (job) => {
    console.log(
      `🎯 HLS job completed: ${job.id}`
    );
  }
);

hlsWorker.on(
  "failed",
  (job, err) => {
    console.error(
      `❌ HLS job failed: ${job?.id}`
    );

    console.error(err);
  }
);

hlsWorker.on(
  "error",
  (err) => {
    console.error(
      "❌ HLS worker connection error:"
    );

    console.error(err);
  }
);

// =====================================
// SHUTDOWN
// =====================================

process.on(
  "SIGINT",
  async () => {
    console.log(
      "Closing HLS worker..."
    );

    await hlsWorker.close();

    process.exit(0);
  }
);