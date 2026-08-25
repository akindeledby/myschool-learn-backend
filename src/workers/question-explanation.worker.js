import { Worker } from "bullmq";

import { db } from "../../lib/db.js";
import { createRedisConnection } from "../../lib/redis.js";

import {
  generateQuestionExplanation,
} from "../services/ai/question-explanation.service.js";


export const questionExplanationWorker =
  new Worker(
    "question-explanation",

    async (job) => {
      const { questionId } =
        job.data;

      if (!questionId) {
        throw new Error(
          "questionId is required."
        );
      }

      try {
        console.log(
          `💡 Processing explanation job for question: ${questionId}`
        );

        // ======================================================
        // FETCH QUESTION
        // ======================================================

        const question =
          await db.question.findUnique({
            where: {
              id: questionId,
            },

            include: {
              quiz: {
                include: {
                  topic: {
                    include: {
                      class: true,
                      subject: true,
                    },
                  },
                },
              },
            },
          });

        if (!question) {
          throw new Error(
            `Question ${questionId} not found.`
          );
        }

        // ======================================================
        // CHECK EXISTING EXPLANATION
        // ======================================================

        if (
          question.explanation &&
          question.explanation.trim()
        ) {
          console.log(
            `⏭️ Explanation already exists for question ${questionId}. Skipping.`
          );

          await job.updateProgress(100);

          return {
            success: true,
            questionId,
            skipped: true,
            reason:
              "Explanation already exists",
          };
        }

        // ======================================================
        // TOPIC CONTEXT
        // ======================================================

        const topic =
          question.quiz?.topic;

        const subjectName =
          topic?.subject?.name ||
          "Not specified";

        const topicTitle =
          topic?.title ||
          "Not specified";

        const className =
          topic?.class?.name ||
          "Not specified";

        // ======================================================
        // UPDATE PROGRESS
        // ======================================================

        await job.updateProgress(20);

        // ======================================================
        // GENERATE EXPLANATION
        // ======================================================

        console.log(
          `🧠 Generating explanation for question ${questionId}...`
        );

        const explanation =
          await generateQuestionExplanation({
            text:
              question.text,

            options:
              question.options,

            correctAnswer:
              question.correctAnswer,

            subjectName,

            topicTitle,

            className,
          });

        await job.updateProgress(70);

        // ======================================================
        // SAVE EXPLANATION
        // ======================================================

        await db.question.update({
          where: {
            id: questionId,
          },

          data: {
            explanation,
          },
        });

        // ======================================================
        // COMPLETE
        // ======================================================

        await job.updateProgress(100);

        console.log(
          `✅ Explanation saved for question ${questionId}`
        );

        return {
          success: true,
          questionId,
          skipped: false,
        };
      } catch (error) {
        console.error(
          `❌ Explanation worker failed for question ${questionId}`
        );

        console.error(error);

        throw error;
      }
    },

    {
      connection:
        createRedisConnection(),

      concurrency: 3,

      lockDuration:
        1000 * 60 * 10,

      stalledInterval:
        1000 * 60,

      maxStalledCount: 3,
    }
  );

// ============================================================
// WORKER EVENTS
// ============================================================

questionExplanationWorker.on(
  "ready",
  () => {
    console.log(
      "✅ Question explanation worker connected to Redis"
    );
  }
);

questionExplanationWorker.on(
  "active",
  (job) => {
    console.log(
      `⚙️ Question explanation job active: ${job.id}`
    );
  }
);

questionExplanationWorker.on(
  "completed",
  (job) => {
    console.log(
      `🎯 Question explanation job completed: ${job.id}`
    );
  }
);

questionExplanationWorker.on(
  "failed",
  (job, err) => {
    console.error(
      `❌ Question explanation job failed: ${job?.id}`
    );

    console.error(err);
  }
);

questionExplanationWorker.on(
  "error",
  (err) => {
    console.error(
      "❌ Question explanation worker connection error:"
    );

    console.error(err);
  }
);

// ============================================================
// SHUTDOWN
// ============================================================

process.on(
  "SIGINT",
  async () => {
    console.log(
      "Closing question explanation worker..."
    );

    await questionExplanationWorker.close();

    process.exit(0);
  }
);