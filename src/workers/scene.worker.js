import { Worker } from "bullmq";
import { db } from "../../lib/db.js";
import { createRedisConnection } from "../../lib/redis.js";

import { generateAllScenes } from "../services/ai/scene-orchestrator.service.js";
import { imageQueue } from "../queues/image.queue.js";

// ============================================================
// QUEUE IMAGE GENERATION
// ============================================================

async function enqueueImageJob(topicId) {
  console.log(
    `🖼️ Queueing image generation for topic: ${topicId}`
  );

  await imageQueue.add(
    "image",
    {
      topicId,
    },
    {
      jobId: `image-${topicId}`,
      removeOnComplete: 20,
      removeOnFail: 50,
    }
  );

  console.log(
    `✅ Image generation job queued for topic: ${topicId}`
  );
}

// ============================================================
// SCENE WORKER
// ============================================================

export const sceneWorker = new Worker(
  "scene",

  async (job) => {
    const { topicId } = job.data;

    try {
      // ======================================================
      // FETCH TOPIC FROM DATABASE
      // ======================================================

      console.log(
        `🔎 Checking database for topic: ${topicId}`
      );

      const topic = await db.topic.findUnique({
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

      console.log(
        `📘 Topic found: ${topic.title}`
      );

      // ======================================================
      // ALREADY COMPLETED
      // ======================================================

      if (topic.status === "COMPLETED") {
        console.log(
          "✅ Topic already completed. Skipping scene worker."
        );

        return {
          success: true,
          topicId,
          skipped: true,
          reason: "Topic already completed",
        };
      }

      // ======================================================
      // CHECK DATABASE FOR EXISTING SCENES
      // ======================================================

      const hasGeneratedScenes =
        topic.generatedScenes != null;

      // ======================================================
      // SCENES ALREADY EXIST
      // ======================================================

      if (hasGeneratedScenes) {
        console.log(
          "📦 Generated scenes already exist in database."
        );

        console.log(
          "⏭️ Skipping scene generation."
        );

        // ----------------------------------------------------
        // Update progress only if necessary
        // ----------------------------------------------------

        if ((topic.progress ?? 0) < 30) {
          await db.topic.update({
            where: {
              id: topicId,
            },

            data: {
              progress: 30,
              currentStage: "GENERATING_IMAGES",
            },
          });

          await job.updateProgress(30);
        }

        // ----------------------------------------------------
        // Continue directly to image generation
        // ----------------------------------------------------

        await enqueueImageJob(topicId);

        return {
          success: true,
          topicId,
          skippedSceneGeneration: true,
          nextStage: "GENERATING_IMAGES",
        };
      }

      // ======================================================
      // LESSON PLAN MUST EXIST
      // ======================================================

      if (topic.lessonPlan == null) {
        throw new Error(
          "Cannot generate scenes because lesson plan does not exist."
        );
      }

      // ======================================================
      // UPDATE STATUS
      // ======================================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          status: "PROCESSING",
          currentStage: "GENERATING_SCENES",
          progress: 25,
        },
      });

      await job.updateProgress(25);

      // ======================================================
      // GENERATE SCENES
      // ======================================================

      console.log(
        "🎬 Generated scenes not found. Generating scenes..."
      );

      const fullScenes = await generateAllScenes({
        subject: topic.subject.name,
        lesson: topic.lessonPlan,
        lessonContents: topic.lessonContents,
        topic: topic.title,
        classLevel: topic.class.name,
      });

      // ======================================================
      // VALIDATE GENERATED SCENES
      // ======================================================

      if (fullScenes == null) {
        throw new Error(
          "Scene generation returned no scenes."
        );
      }

      // ======================================================
      // SAVE SCENES TO DATABASE
      // ======================================================

      console.log(
        "💾 Saving generated scenes to database..."
      );

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          generatedScenes: fullScenes,
        },
      });

      console.log(
        "✅ Scenes generated and saved successfully."
      );

      // ======================================================
      // UPDATE STATUS
      // ======================================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          progress: 30,
          currentStage: "GENERATING_IMAGES",
        },
      });

      await job.updateProgress(30);

      // ======================================================
      // QUEUE IMAGE GENERATION
      // ======================================================

      await enqueueImageJob(topicId);

      // ======================================================
      // COMPLETE
      // ======================================================

      return {
        success: true,

        topicId,

        skippedSceneGeneration: false,

        nextStage: "GENERATING_IMAGES",
      };

    } catch (error) {
      // ======================================================
      // ERROR
      // ======================================================

      console.error(
        `❌ Scene worker failed for topic: ${topicId}`
      );

      console.error(error);

      // ======================================================
      // MARK TOPIC FAILED
      // ======================================================

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
    connection: createRedisConnection(),

    concurrency: 1,

    lockDuration:
      1000 * 60 * 30,

    stalledInterval:
      1000 * 60,

    maxStalledCount: 3,
  }
);

// ============================================================
// WORKER EVENTS
// ============================================================

sceneWorker.on(
  "ready",
  () => {
    console.log(
      "✅ Scene worker connected to Redis"
    );
  }
);

sceneWorker.on(
  "active",
  (job) => {
    console.log(
      `⚙️ Scene job active: ${job.id}`
    );
  }
);

sceneWorker.on(
  "completed",
  (job) => {
    console.log(
      `🎯 Scene job completed: ${job.id}`
    );
  }
);

sceneWorker.on(
  "failed",
  (job, err) => {
    console.error(
      `❌ Scene job failed: ${job?.id}`
    );

    console.error(err);
  }
);

sceneWorker.on(
  "error",
  (err) => {
    console.error(
      "❌ Scene worker connection error:"
    );

    console.error(err);
  }
);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

process.on(
  "SIGINT",

  async () => {
    console.log(
      "Closing scene worker..."
    );

    await sceneWorker.close();

    process.exit(0);
  }
);
