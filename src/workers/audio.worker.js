import { Worker } from "bullmq";
import { db } from "../../lib/db.js";
import { createRedisConnection } from "../../lib/redis.js";
import { videoQueue } from "../queues/video.queue.js";
import { generateTTS } from "../services/audio/tts.service.js";

// =====================================
// AUDIO WORKER
// =====================================

export const audioWorker = new Worker(
  "audio",

  async (job) => {
    const { topicId } = job.data;

    try {
      // =====================================
      // FETCH TOPIC
      // =====================================

      const topic =
        await db.topic.findUnique({
          where: {
            id: topicId,
          },

          include: {
            subject: true,
            class: true,
          },
        });

      if (!topic) {
        throw new Error("Topic not found");
      }

      // =====================================
      // ALREADY COMPLETED
      // =====================================

      if (topic.status === "COMPLETED") {
        console.log(
          "✅ Topic already completed. Skipping audio worker."
        );

        return {
          success: true,
          topicId,
          skipped: true,
          reason: "Topic already completed",
        };
      }

      // =====================================
      // GET SCENES
      // =====================================

      const scenes =
        Array.isArray(topic.generatedScenes)
          ? topic.generatedScenes
          : [];

      if (!scenes.length) {
        throw new Error(
          "No generated scenes found"
        );
      }

      console.log(
        `🎧 Processing audio for ${scenes.length} scenes`
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
            "GENERATING_AUDIO",
          progress: 60,
        },
      });

      await job.updateProgress(50);

      // =====================================
      // GENERATE ONLY MISSING AUDIO
      // =====================================

      const updatedScenes =
        await Promise.all(
          scenes.map(async (scene, index) => {
            // =================================
            // AUDIO ALREADY EXISTS
            // =================================

            if (
              scene.audioUrl &&
              scene.durationInSeconds != null &&
              scene.durationInFrames != null
            ) {
              console.log(
                `📦 Scene ${index} already has audio. Skipping TTS.`
              );

              return scene;
            }

            // =================================
            // AUDIO DOES NOT EXIST
            // =================================

            console.log(
              `🎤 Scene ${index} needs audio. Generating...`
            );

            const audioResult =
              await generateTTS({
                topicId,
                sceneId: index,
                text: scene.narration,
              });

            return {
              ...scene,

              audioUrl:
                audioResult.audioUrl,

              durationInSeconds:
                audioResult.durationInSeconds,

              durationInFrames:
                audioResult.durationInFrames,
            };
          })
        );

      console.log(
        "✅ Audio generation/check completed"
      );

      // =====================================
      // SAVE UPDATED SCENES
      // =====================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          generatedScenes:
            updatedScenes,

          currentStage:
            "RENDERING_VIDEO",

          progress: 60,
        },
      });

      await job.updateProgress(60);

      // =====================================
      // ENQUEUE VIDEO JOB
      // =====================================

      await videoQueue.add(
        "video",
        {
          topicId,
        },
        {
          jobId: `video-${topicId}`,
          removeOnComplete: 20,
          removeOnFail: 50,
        }
      );

      console.log(
        "🚀 Video rendering job queued"
      );

      // =====================================
      // RETURN
      // =====================================

      return {
        success: true,
        topicId,
        nextStage:
          "RENDERING_VIDEO",
      };
    } catch (error) {
      console.error(
        "❌ Audio worker failed:"
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
          currentStage: "FAILED",
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
// WORKER EVENTS
// =====================================

audioWorker.on(
  "ready",
  () => {
    console.log(
      "✅ Audio worker connected to Redis"
    );
  }
);

audioWorker.on(
  "active",
  (job) => {
    console.log(
      `⚙️ Audio job active: ${job.id}`
    );
  }
);

audioWorker.on(
  "completed",
  (job) => {
    console.log(
      `🎯 Audio job completed: ${job.id}`
    );
  }
);

audioWorker.on(
  "failed",
  (job, err) => {
    console.error(
      `❌ Audio job failed: ${job?.id}`
    );

    console.error(err);
  }
);

audioWorker.on(
  "error",
  (err) => {
    console.error(
      "❌ Audio worker connection error:"
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
      "Closing audio worker..."
    );

    await audioWorker.close();

    process.exit(0);
  }
);

