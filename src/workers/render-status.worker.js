
import { Worker } from "bullmq";
import { getRenderProgress } from "@remotion/lambda";
import { db } from "../../lib/db.js";
import { createRedisConnection } from "../../lib/redis.js";

import {
  renderStatusQueue,
} from "../queues/render-status.queue.js";

import { hlsQueue } from "../queues/hls.queue.js";

// =====================================
// ENV
// =====================================

const region =
  process.env.AWS_REGION;

const functionName =
  process.env.REMOTION_FUNCTION_NAME;

if (!region) {
  throw new Error(
    "AWS_REGION missing"
  );
}

if (!functionName) {
  throw new Error(
    "REMOTION_FUNCTION_NAME missing"
  );
}

// =====================================
// WORKER
// =====================================

export const renderStatusWorker =
  new Worker(
    "status",

    async (job) => {
      const {
        topicId,
        renderId,
        bucketName,
      } = job.data;

      try {
        console.log(
          `🔍 Checking render progress for ${topicId}`
        );

        // =====================================
        // GET RENDER PROGRESS
        // =====================================

        const progress =
          await getRenderProgress({
            renderId,
            bucketName,
            functionName,
            region,
          });

        // =====================================
        // FAILED
        // =====================================

        if (
          progress.fatalErrorEncountered
        ) {
          console.error(
            "❌ Lambda render failed"
          );

          console.error(
            progress.errors
          );

          await db.topic.update({
            where: {
              id: topicId,
            },

            data: {
              status: "FAILED",

              renderStatus:
                "FAILED",

              currentStage:
                "RENDER_FAILED",
            },
          });

          return {
            success: false,
            topicId,
          };
        }

        // =====================================
        // COMPLETED
        // =====================================

        if (progress.done) {
          console.log(
            "✅ Render completed"
          );

          console.log(
            "🎥 Output:",
            progress.outputFile
          );

          await db.topic.update({
            where: {
              id: topicId,
            },

            data: {
              renderStatus: "COMPLETED",
              renderedVideoUrl: progress.outputFile,
              renderProgress: 100,
              progress: 85,
              currentStage: "VIDEO_RENDERED",
            },
          });

          // =====================================
          // START HLS
          // =====================================

          await hlsQueue.add(
            "generate-hls",
            {
              topicId,
            },
            {
              jobId: `hls-${topicId}`,
              removeOnComplete: 20,
              removeOnFail: 50,
            }
          );

          console.log(
            "📦 HLS generation queued"
          );

          return {
            success: true,
            topicId,
            output:
              progress.outputFile,
          };
        }

        // =====================================
        // STILL RENDERING
        // =====================================

        const percentage =
          Math.round(
            (progress.overallProgress ||
              0) * 100
          );

        console.log(
          `⏳ Still rendering: ${percentage}%`
        );

        // =====================================
        // UPDATE DATABASE
        // =====================================

        await db.topic.update({
          where: {
            id: topicId,
          },

          data: {
            renderStatus:
              "RENDERING",

            renderProgress:
              percentage,
          },
        });

        // =====================================
        // REQUEUE AFTER 15 SECONDS
        // =====================================

        await renderStatusQueue.add(
          "check-render-status",

          {
            topicId,
            renderId,
            bucketName,
          },

          {
            delay: 15000,

            removeOnComplete: 20,

            removeOnFail: 50,
          }
        );

        console.log(
          "🔁 Requeued render status check"
        );

        return {
          success: true,
          topicId,
          progress: percentage,
        };

      } catch (error) {
        console.error(
          "❌ Render status worker failed:"
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

// =====================================
// EVENTS
// =====================================

renderStatusWorker.on(
  "ready",

  () => {
    console.log(
      "✅ Render status worker connected"
    );
  }
);

renderStatusWorker.on(
  "active",

  (job) => {
    console.log(
      `⚙️ Render status job active: ${job.id}`
    );
  }
);

renderStatusWorker.on(
  "completed",

  (job) => {
    console.log(
      `🎯 Render status job completed: ${job.id}`
    );
  }
);

renderStatusWorker.on(
  "failed",

  (job, err) => {
    console.error(
      `❌ Render status job failed: ${job?.id}`
    );

    console.error(err);
  }
);

renderStatusWorker.on(
  "error",

  (err) => {
    console.error(
      "❌ Render status worker error:"
    );

    console.error(err);
  }
);

// =====================================
// CLEAN SHUTDOWN
// =====================================

process.on(
  "SIGINT",

  async () => {
    console.log(
      "Closing render status worker..."
    );

    await renderStatusWorker.close();

    process.exit(0);
  }
);