import { Worker } from "bullmq";
import { renderMediaOnLambda } from "@remotion/lambda";

import { db } from "../../lib/db.js";
import { createRedisConnection } from "../../lib/redis.js";
import { renderStatusQueue } from "../queues/render-status.queue.js";

import { buildRemotionScene } from "../services/rendering/remotion-renderer.service.js";

// =====================================
// ENV
// =====================================

const serveUrl =
  process.env.REMOTION_SERVE_URL;

const region =
  process.env.AWS_REGION;

const functionName =
  process.env.REMOTION_FUNCTION_NAME;

if (!serveUrl) {
  throw new Error(
    "REMOTION_SERVE_URL missing"
  );
}

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
// FRAMES PER LAMBDA
// =====================================

function getFramesPerLambda(totalFrames) {
  if (totalFrames <= 10000) {
    return 400;
  }

  if (totalFrames <= 30000) {
    return 600;
  }

  return 800;
}

// =====================================
// VIDEO WORKER
// =====================================

export const videoWorker = new Worker(
  "video",

  async (job) => {
    const { topicId } = job.data;

    try {
      console.log(
        `🎬 Video job started for topic ${topicId}`
      );

      // =====================================
      // FETCH TOPIC
      // =====================================

      const topic =
        await db.topic.findUnique({
          where: {
            id: topicId,
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
        topic.status === "COMPLETED" ||
        topic.renderStatus === "COMPLETED"
      ) {
        console.log(
          "✅ Video already completed. Skipping video worker."
        );

        return {
          success: true,
          topicId,
          skipped: true,
          reason: "Video already completed",
          renderId: topic.renderId,
        };
      }

      // =====================================
      // RENDER ALREADY IN PROGRESS
      // =====================================

      if (
        topic.renderId &&
        (
          topic.renderStatus === "RENDERING" ||
          topic.renderStatus === "PREPARING_RENDER"
        )
      ) {
        console.log(
          "📦 Video render already exists. Skipping duplicate render."
        );

        return {
          success: true,
          topicId,
          skipped: true,
          reason: "Video render already in progress",
          renderId: topic.renderId,
        };
      }

      // =====================================
      // GET SCENES
      // =====================================

      const scenes =
        topic.generatedScenes || [];

      if (!scenes.length) {
        throw new Error(
          "No generated scenes found"
        );
      }

      // =====================================
      // CHECK AUDIO
      // =====================================

      const scenesWithoutAudio =
        scenes.filter(
          (scene) => !scene.audioUrl
        );

      if (
        scenesWithoutAudio.length > 0
      ) {
        throw new Error(
          `Missing audioUrl for ${scenesWithoutAudio.length} scene(s)`
        );
      }

      // =====================================
      // CALCULATE TOTAL FRAMES
      // =====================================

      const totalFrames =
        scenes.reduce(
          (sum, scene) => {
            return (
              sum +
              (
                scene.durationInFrames ||
                150
              )
            );
          },
          0
        );

      const framesPerLambda =
        getFramesPerLambda(
          totalFrames
        );

      console.log(
        "📊 Total frames:",
        totalFrames
      );

      console.log(
        "⚙️ Frames per Lambda:",
        framesPerLambda
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
            "RENDERING_VIDEO",

          renderStatus:
            "PREPARING_RENDER",

          progress: 55,
        },
      });

      await job.updateProgress(55);

      // =====================================
      // BUILD REMOTION SCENES
      // =====================================

      console.log(
        "🧱 Preparing Remotion scenes..."
      );

      const remotionScenes =
        scenes.map(
          (scene, index) => {
            if (!scene.audioUrl) {
              throw new Error(
                `Missing audioUrl for scene ${index}`
              );
            }

            return buildRemotionScene({
              scene,

              narration:
                scene.narration,

              blocks:
                scene.blocks,

              audioUrl:
                scene.audioUrl,

              durationInFrames:
                scene.durationInFrames ||
                150,
            });
          }
        );

      console.log(
        "✅ Remotion scenes prepared"
      );

      // =====================================
      // START AWS LAMBDA RENDER
      // =====================================

      console.log(
        "🚀 Starting Lambda video render..."
      );

      const renderResponse =
        await renderMediaOnLambda({
          region,

          serveUrl,

          functionName,

          composition:
            "LessonVideo",

          codec: "h264",

          imageFormat:
            "jpeg",

          privacy: "public",

          framesPerLambda,

          concurrencyPerLambda: 1,

          delayRenderTimeoutInMilliseconds:
            120000,

          maxRetries: 3,

          inputProps: {
            scenes:
              remotionScenes,
          },
        });

      console.log(
        "✅ Lambda video render started"
      );

      console.log(
        "🆔 Render ID:",
        renderResponse.renderId
      );

      // =====================================
      // SAVE RENDER DETAILS
      // =====================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          renderId:
            renderResponse.renderId,

          renderBucket:
            renderResponse.bucketName,

          renderStatus:
            "RENDERING",

          currentStage:
            "RENDERING_VIDEO",

          progress: 75,
        },
      });

      await job.updateProgress(75);

      // =====================================
      // QUEUE RENDER STATUS CHECK
      // =====================================

      await renderStatusQueue.add(
        "check-render-status",
        {
          topicId,

          renderId:
            renderResponse.renderId,

          bucketName:
            renderResponse.bucketName,
        },
        {
          jobId:
            `render-status-${topicId}`,

          delay: 15000,

          attempts: 100,

          removeOnComplete: 20,

          removeOnFail: 50,
        }
      );

      console.log(
        "📡 Video render status polling queued"
      );

      // =====================================
      // RETURN
      // =====================================

      return {
        success: true,

        topicId,

        renderId:
          renderResponse.renderId,

        nextStage:
          "RENDERING_VIDEO",
      };

    } catch (error) {
      console.error(
        "❌ Video worker failed:"
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

          renderStatus:
            "FAILED",

          currentStage:
            "RENDER_FAILED",
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

videoWorker.on(
  "ready",
  () => {
    console.log(
      "✅ Video worker connected to Redis"
    );
  }
);

videoWorker.on(
  "active",
  (job) => {
    console.log(
      `⚙️ Render job active: ${job.id}`
    );
  }
);

videoWorker.on(
  "completed",
  (job) => {
    console.log(
      `🎯 Render job completed: ${job.id}`
    );
  }
);

videoWorker.on(
  "failed",
  (job, err) => {
    console.error(
      `❌ Render job failed: ${job?.id}`
    );

    console.error(err);
  }
);

videoWorker.on(
  "error",
  (err) => {
    console.error(
      "❌ Video worker connection error:"
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
      "Closing video render worker..."
    );

    await videoWorker.close();

    process.exit(0);
  }
);
