import { Worker } from "bullmq";

import { db } from "../../lib/db.js";
import { createRedisConnection } from "../../lib/redis.js";

import { audioQueue } from "../queues/audio.queue.js";
import { generateSceneImages } from "../services/image/image-generator.service.js";

// =====================================
// IMAGE WORKER
// =====================================

export const imageWorker = new Worker(
  "image",

  async (job) => {
    const { topicId } = job.data;

    try {
      console.log(
        `🖼️ Image job started for topic ${topicId}`
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
        topic.status === "COMPLETED"
      ) {
        console.log(
          "✅ Topic already completed. Skipping image worker."
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
      // GET SCENES
      // =====================================

      const scenes =
        topic.generatedScenes || [];

      if (
        !Array.isArray(scenes) ||
        scenes.length === 0
      ) {
        throw new Error(
          "No generated scenes found."
        );
      }

      // =====================================
      // CHECK WHETHER ALL IMAGES
      // ARE ALREADY GENERATED
      // =====================================

      const hasPendingImages =
        scenes.some((scene) => {
          const imageBlocks =
            Array.isArray(scene.blocks)
              ? scene.blocks.filter(
                  (block) =>
                    block.type === "image"
                )
              : [];

          if (
            imageBlocks.length === 0
          ) {
            return false;
          }

          return imageBlocks.some(
            (block) =>
              !block.imageUrl
          );
        });

      // =====================================
      // IMAGES ALREADY COMPLETE
      // =====================================

      if (!hasPendingImages) {
        console.log(
          "📦 All scene images already exist. Skipping image generation."
        );

        // Make sure the pipeline continues
        if (
          (topic.progress ?? 0) <
          45
        ) {
          await db.topic.update({
            where: {
              id: topicId,
            },

            data: {
              currentStage:
                "GENERATING_AUDIO",

              progress: 45,
            },
          });
        }

        await job.updateProgress(
          45
        );

        // =====================================
        // QUEUE AUDIO
        // =====================================

        await audioQueue.add(
          "audio",
          {
            topicId,
          },
          {
            jobId:
              `audio-${topicId}`,

            removeOnComplete: 20,

            removeOnFail: 50,
          }
        );

        console.log(
          "🎤 Audio generation queued."
        );

        return {
          success: true,
          topicId,

          skippedImageGeneration:
            true,

          nextStage:
            "GENERATING_AUDIO",
        };
      }

      // =====================================
      // UPDATE STATUS
      // =====================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          currentStage:
            "GENERATING_IMAGES",

          progress: 35,
        },
      });

      await job.updateProgress(
        35
      );

      console.log(
        `🖼️ Checking images for ${scenes.length} scenes...`
      );

      // =====================================
      // GENERATE MISSING IMAGES
      // =====================================

      const updatedScenes = [];

      for (
        let sceneIndex = 0;
        sceneIndex < scenes.length;
        sceneIndex++
      ) {
        const scene =
          scenes[sceneIndex];

        const imageBlocks =
          Array.isArray(scene.blocks)
            ? scene.blocks.filter(
                (block) =>
                  block.type === "image"
              )
            : [];

        // =====================================
        // NO IMAGE BLOCKS
        // =====================================

        if (
          imageBlocks.length === 0
        ) {
          updatedScenes.push(
            scene
          );

          const progress =
            35 +
            Math.round(
              ((sceneIndex + 1) /
                scenes.length) *
                10
            );

          await job.updateProgress(
            progress
          );

          continue;
        }

        // =====================================
        // CHECK IF SCENE NEEDS IMAGES
        // =====================================

        const sceneNeedsImages =
          imageBlocks.some(
            (block) =>
              !block.imageUrl
          );

        // =====================================
        // SCENE ALREADY COMPLETE
        // =====================================

        if (!sceneNeedsImages) {
          console.log(
            `📦 Scene ${sceneIndex} images already exist. Skipping.`
          );

          updatedScenes.push(
            scene
          );

          const progress =
            35 +
            Math.round(
              ((sceneIndex + 1) /
                scenes.length) *
                10
            );

          await job.updateProgress(
            progress
          );

          continue;
        }

        // =====================================
        // GENERATE MISSING IMAGES
        // =====================================

        console.log(
          `🎨 Generating missing images for scene ${sceneIndex}`
        );

        const updatedScene =
          await generateSceneImages({
            topicId,

            scene,

            sceneIndex,
          });

        updatedScenes.push(
          updatedScene
        );

        const progress =
          35 +
          Math.round(
            ((sceneIndex + 1) /
              scenes.length) *
              10
          );

        await job.updateProgress(
          progress
        );
      }

      console.log(
        "✅ Image generation/check complete."
      );

      // =====================================
      // DEBUG OUTPUT
      // =====================================

      updatedScenes.forEach(
        (
          scene,
          sceneIndex
        ) => {
          scene.blocks
            ?.filter(
              (block) =>
                block.type === "image"
            )
            .forEach(
              (
                block,
                blockIndex
              ) => {
                console.log(
                  `Scene ${sceneIndex} Block ${blockIndex}`
                );

                console.log(
                  "Image URL:",
                  block.imageUrl ||
                    "NONE"
                );

                console.log(
                  "Image Error:",
                  block.imageError ||
                    false
                );
              }
            );
        }
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
            "GENERATING_AUDIO",

          progress: 45,
        },
      });

      await job.updateProgress(
        45
      );

      console.log(
        "✅ Updated scenes saved."
      );

      // =====================================
      // QUEUE AUDIO
      // =====================================

      await audioQueue.add(
        "audio",
        {
          topicId,
        },
        {
          jobId:
            `audio-${topicId}`,
          removeOnComplete: 20,
          removeOnFail: 50,
        }
      );

      console.log(
        "🎤 Audio generation queued."
      );

      // =====================================
      // RETURN
      // =====================================

      return {
        success: true,

        topicId,

        nextStage:
          "GENERATING_AUDIO",
      };

    } catch (error) {
      console.error(
        "❌ Image worker failed."
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
            "FAILED",
        },
      });

      throw error;
    }
  },

  {
    connection:
      createRedisConnection(),

    concurrency: 2,

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

imageWorker.on(
  "ready",
  () => {
    console.log(
      "✅ Image worker connected to Redis"
    );
  }
);

imageWorker.on(
  "active",
  (job) => {
    console.log(
      `⚙️ Image job active: ${job.id}`
    );
  }
);

imageWorker.on(
  "completed",
  (job) => {
    console.log(
      `🎯 Image job completed: ${job.id}`
    );
  }
);

imageWorker.on(
  "failed",
  (job, err) => {
    console.error(
      `❌ Image job failed: ${job?.id}`
    );

    console.error(err);
  }
);

imageWorker.on(
  "error",
  (err) => {
    console.error(
      "❌ Image worker connection error:"
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
      "Closing image worker..."
    );

    await imageWorker.close();

    process.exit(0);
  }
);