import { Worker } from "bullmq";
import { db } from "../../lib/db.js";
import { createRedisConnection } from "../../lib/redis.js";
import { sceneQueue } from "../queues/scene.queue.js";
import { quizQueue } from "../queues/quiz.queue.js";
import { createLessonPlanningCache } from "../services/ai/lesson-planning-cache.service.js";
import { generateLessonPlan } from "../services/ai/lesson-planner.service.js";

// =====================================
// QUEUE HELPERS
// =====================================

async function enqueueContentJobs(topicId) {
  console.log(
    "🚀 Queueing scene and quiz generation..."
  );

  await Promise.all([
    sceneQueue.add(
      "scene",
      {
        topicId,
      },
      {
        jobId: `scene-${topicId}`,
        removeOnComplete: 20,
        removeOnFail: 50,
      }
    ),

    quizQueue.add(
      "quiz",
      {
        topicId,
      },
      {
        jobId: `quiz-${topicId}`,
        removeOnComplete: 20,
        removeOnFail: 50,
      }
    ),
  ]);

  console.log(
    "✅ Scene and quiz jobs queued"
  );
}

export const lessonWorker = new Worker(
  "lesson",

  async (job) => {
    const { topicId } = job.data;

    try {
      // =====================================
      // FETCH TOPIC
      // =====================================

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

      // =====================================
      // ALREADY COMPLETED
      // =====================================

      if (topic.status === "COMPLETED") {
        console.log(
          "✅ Topic already completed. Skipping lesson worker."
        );

        return {
          success: true,
          topicId,
          skipped: true,
          reason: "Topic already completed",
        };
      }

      // =====================================
      // LESSON ALREADY EXISTS
      // =====================================

      const hasLessonPlan =
        topic.lessonPlan != null;

      const hasLessonContents =
        Array.isArray(
          topic.lessonContents
        ) &&
        topic.lessonContents.length > 0;

      if (
        hasLessonPlan &&
        hasLessonContents
      ) {
        console.log(
          "📦 Lesson already exists. Skipping lesson planning."
        );

        if (
          (topic.progress ?? 0) < 15
        ) {
          await db.topic.update({
            where: {
              id: topicId,
            },

            data: {
              progress: 15,
              currentStage:
                "GENERATING_CONTENT",
            },
          });

          await job.updateProgress(15);
        }

        await enqueueContentJobs(topicId);

        return {
          success: true,
          topicId,
          skippedLessonPlanning: true,
          nextStages: [
            "GENERATING_SCENES",
            "GENERATING_QUIZ",
          ],
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
          status: "PROCESSING",
          progress: 10,
          currentStage: "PLANNING_LESSON",
        },
      });

      await job.updateProgress(5);

      // =====================================
      // GENERATE LESSON PLAN
      // =====================================

      let lesson =
        topic.lessonPlan;

      if (!lesson) {
        console.log(
          "📘 Generating lesson plan..."
        );

        // lesson =
        //   await generateLessonPlan({
        //     subject: topic.subject.name,
        //     classLevel: topic.class.name,
        //     topic: topic.title,
            // lessonContents:
            //   topic.lessonContents ??
            //   [],
        //   });

        const cache =
          await createLessonPlanningCache({
            subject: topic.subject.name,
            classLevel: topic.class.name,
            topic: topic.title,
                lessonContents:
              topic.lessonContents ??
              [],
          });

        const lessonPlan =
          await generateLessonPlan({
            cacheName: cache.name,
          });

        // console.log(
        //   `🧠 Using lesson planning cache: ${cacheName}`
        // );

        await db.topic.update({
          where: {
            id: topicId,
          },

          data: {
            lessonPlan: lessonPlan,
          },
        });

        console.log(
          "✅ Lesson plan generated"
        );
      } else {
        console.log(
          "📦 Using cached lesson plan"
        );
      }

      // =====================================
      // UPDATE STATUS
      // =====================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          progress: 15,
          currentStage:
            "GENERATING_CONTENT",
        },
      });

      await job.updateProgress(15);

      // =====================================
      // ENQUEUE CONTENT JOBS
      // =====================================

      await enqueueContentJobs(topicId);

      // =====================================
      // COMPLETE
      // =====================================

      return {
        success: true,
        topicId,
        nextStages: [
          "GENERATING_SCENES",
          "GENERATING_QUIZ",
        ],
      };
    } catch (error) {
      console.error(
        "❌ Lesson worker failed:"
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

lessonWorker.on(
  "ready",
  () => {
    console.log(
      "✅ Lesson worker connected to Redis"
    );
  }
);

lessonWorker.on(
  "active",
  (job) => {
    console.log(
      `⚙️ Lesson job active: ${job.id}`
    );
  }
);

lessonWorker.on(
  "completed",
  (job) => {
    console.log(
      `🎯 Lesson job completed: ${job.id}`
    );
  }
);

lessonWorker.on(
  "failed",
  (job, err) => {
    console.error(
      `❌ Lesson job failed: ${job?.id}`
    );

    console.error(err);
  }
);

lessonWorker.on(
  "error",
  (err) => {
    console.error(
      "❌ Lesson worker connection error:"
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
      "Closing lesson worker..."
    );

    await lessonWorker.close();

    process.exit(0);
  }
);