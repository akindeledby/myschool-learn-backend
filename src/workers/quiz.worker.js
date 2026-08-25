import { Worker } from "bullmq";
import { db } from "../../lib/db.js";
import { createRedisConnection } from "../../lib/redis.js";
import { generateQuizForTopic } from "../services/ai/quiz-generator.service.js";
import { questionExplanationQueue } from "../queues/question-explanation.queue.js";

// ============================================================
// QUIZ WORKER
// ============================================================

async function queueMissingQuestionExplanations(
  questions
) {
  if (!Array.isArray(questions)) {
    return 0;
  }

  let queuedCount = 0;

  for (const question of questions) {
    if (
      question.explanation &&
      question.explanation.trim()
    ) {
      continue;
    }

    await questionExplanationQueue.add(
      "generate-explanation",
      {
        questionId:
          question.id,
      },

      {
        jobId:
          `question-explanation-${question.id}`,
      }
    );

    queuedCount++;
  }

  return queuedCount;
}

export const quizWorker = new Worker(
  "quiz",

  async (job) => {
    const { topicId } = job.data;

    try {
      console.log(
        `📝 Processing quiz job for topic: ${topicId}`
      );

      // ======================================================
      // FETCH TOPIC
      // ======================================================

      const topic = await db.topic.findUnique({
        where: {
          id: topicId,
        },
      });

      if (!topic) {
        throw new Error("Topic not found");
      }

      // ======================================================
      // CHECK IF TOPIC IS ALREADY COMPLETED
      // ======================================================

      if (topic.status === "COMPLETED") {
        console.log(
          "✅ Topic already completed. Skipping quiz worker."
        );

        return {
          success: true,
          topicId,
          skipped: true,
          reason: "Topic already completed",
        };
      }

      // ======================================================
      // CHECK DATABASE FOR EXISTING QUIZ
      // ======================================================
      //
      // IMPORTANT:
      //
      // Always check the database before calling Gemini.
      //
      // This protects against:
      //
      // 1. BullMQ retries
      // 2. Duplicate jobs
      // 3. Worker restarts
      // 4. Accidental duplicate queueing
      //
      // If a quiz already exists, Gemini is NOT called.
      // ======================================================

      const existingQuiz = await db.quiz.findFirst({
        where: {
          topicId,
        },
      });

      // ======================================================
      // QUIZ ALREADY EXISTS
      // ======================================================

      if (existingQuiz) {
        console.log(
          `📦 Quiz already exists for topic ${topicId}.`
        );

        console.log(
          "⏭️ Skipping quiz generation."
        );

        // ----------------------------------------------------
        // Make sure progress reflects that quiz generation
        // has already been completed.
        // ----------------------------------------------------

        if ((topic.progress ?? 0) < 40) {
          await db.topic.update({
            where: {
              id: topicId,
            },

            data: {
              progress: 40,
              currentStage: "GENERATING_QUIZ",
            },
          });
        }

        await job.updateProgress(100);

        return {
          success: true,
          topicId,
          quizId: existingQuiz.id,
          skippedQuizGeneration: true,
          reason: "Quiz already exists",
        };
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
          currentStage: "GENERATING_QUIZ",
          progress: 20,
        },
      });

      await job.updateProgress(20);

      // ======================================================
      // GENERATE QUIZ
      // ======================================================

      console.log(
        `🧠 No existing quiz found for topic ${topicId}.`
      );

      console.log(
        "📝 Generating quiz..."
      );

      const quiz =
        await generateQuizForTopic(topicId);

      const missingExplanationCount =
        await queueMissingQuestionExplanations(
          quiz.questions
        );

      if (
        missingExplanationCount > 0
      ) {
        console.log(
          `💡 Queued ${missingExplanationCount} question(s) for explanation generation.`
        );
      }

      console.log(
        `✅ Quiz generated successfully: ${quiz.id}`
      );

      // ======================================================
      // UPDATE PROGRESS
      // ======================================================

      await db.topic.update({
        where: {
          id: topicId,
        },

        data: {
          currentStage: "GENERATING_QUIZ",
          progress: 40,
        },
      });

      await job.updateProgress(100);

      // ======================================================
      // RETURN
      // ======================================================

      return {
        success: true,
        topicId,
        quizId: quiz.id,
        skippedQuizGeneration: false,
        nextStage: "GENERATING_QUIZ",
      };

    } catch (error) {
      console.error(
        `❌ Quiz worker failed for topic: ${topicId}`
      );

      console.error(error);

      // ======================================================
      // MARK TOPIC AS FAILED
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

quizWorker.on(
  "ready",
  () => {
    console.log(
      "✅ Quiz worker connected to Redis"
    );
  }
);

quizWorker.on(
  "active",
  (job) => {
    console.log(
      `⚙️ Quiz job active: ${job.id}`
    );
  }
);

quizWorker.on(
  "completed",
  (job) => {
    console.log(
      `🎯 Quiz job completed: ${job.id}`
    );
  }
);

quizWorker.on(
  "failed",
  (job, err) => {
    console.error(
      `❌ Quiz job failed: ${job?.id}`
    );

    console.error(err);
  }
);

quizWorker.on(
  "error",
  (err) => {
    console.error(
      "❌ Quiz worker connection error:"
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
      "Closing quiz worker..."
    );

    await quizWorker.close();

    process.exit(0);
  }
);


// import { Worker } from "bullmq";
// import { db } from "../../lib/db.js";
// import { createRedisConnection } from "../../lib/redis.js";
// import { generateQuizForTopic } from "../services/ai/quiz-generator.service.js";

// // ============================================================
// // QUIZ WORKER
// // ============================================================

// export const quizWorker = new Worker(
//   "quiz",

//   async (job) => {
//     const { topicId } = job.data;

//     try {
//       console.log(
//         `📝 Processing quiz job for topic: ${topicId}`
//       );

//       // ======================================================
//       // FETCH TOPIC
//       // ======================================================

//       const topic = await db.topic.findUnique({
//         where: {
//           id: topicId,
//         },
//       });

//       if (!topic) {
//         throw new Error("Topic not found");
//       }

//       // ======================================================
//       // CHECK IF TOPIC IS ALREADY COMPLETED
//       // ======================================================

//       if (topic.status === "COMPLETED") {
//         console.log(
//           "✅ Topic already completed. Skipping quiz worker."
//         );

//         return {
//           success: true,
//           topicId,
//           skipped: true,
//           reason: "Topic already completed",
//         };
//       }

//       // ======================================================
//       // CHECK DATABASE FOR EXISTING QUIZ
//       // ======================================================
//       //
//       // IMPORTANT:
//       //
//       // Always check the database before calling Gemini.
//       //
//       // This protects against:
//       //
//       // 1. BullMQ retries
//       // 2. Duplicate jobs
//       // 3. Worker restarts
//       // 4. Accidental duplicate queueing
//       //
//       // If a quiz already exists, Gemini is NOT called.
//       // ======================================================

//       const existingQuiz = await db.quiz.findFirst({
//         where: {
//           topicId,
//         },
//       });

//       // ======================================================
//       // QUIZ ALREADY EXISTS
//       // ======================================================

//       if (existingQuiz) {
//         console.log(
//           `📦 Quiz already exists for topic ${topicId}.`
//         );

//         console.log(
//           "⏭️ Skipping quiz generation."
//         );

//         // ----------------------------------------------------
//         // Make sure progress reflects that quiz generation
//         // has already been completed.
//         // ----------------------------------------------------

//         if ((topic.progress ?? 0) < 40) {
//           await db.topic.update({
//             where: {
//               id: topicId,
//             },

//             data: {
//               progress: 40,
//               currentStage: "GENERATING_QUIZ",
//             },
//           });
//         }

//         await job.updateProgress(100);

//         return {
//           success: true,
//           topicId,
//           quizId: existingQuiz.id,
//           skippedQuizGeneration: true,
//           reason: "Quiz already exists",
//         };
//       }

//       // ======================================================
//       // UPDATE STATUS
//       // ======================================================

//       await db.topic.update({
//         where: {
//           id: topicId,
//         },

//         data: {
//           status: "PROCESSING",
//           currentStage: "GENERATING_QUIZ",
//           progress: 20,
//         },
//       });

//       await job.updateProgress(20);

//       // ======================================================
//       // GENERATE QUIZ
//       // ======================================================

//       console.log(
//         `🧠 No existing quiz found for topic ${topicId}.`
//       );

//       console.log(
//         "📝 Generating quiz..."
//       );

//       const quiz =
//         await generateQuizForTopic(topicId);

//       console.log(
//         `✅ Quiz generated successfully: ${quiz.id}`
//       );

//       // ======================================================
//       // UPDATE PROGRESS
//       // ======================================================

//       await db.topic.update({
//         where: {
//           id: topicId,
//         },

//         data: {
//           currentStage: "GENERATING_QUIZ",
//           progress: 40,
//         },
//       });

//       await job.updateProgress(100);

//       // ======================================================
//       // RETURN
//       // ======================================================

//       return {
//         success: true,
//         topicId,
//         quizId: quiz.id,
//         skippedQuizGeneration: false,
//         nextStage: "GENERATING_QUIZ",
//       };

//     } catch (error) {
//       console.error(
//         `❌ Quiz worker failed for topic: ${topicId}`
//       );

//       console.error(error);

//       // ======================================================
//       // MARK TOPIC AS FAILED
//       // ======================================================

//       await db.topic.updateMany({
//         where: {
//           id: topicId,

//           status: {
//             not: "COMPLETED",
//           },
//         },

//         data: {
//           status: "FAILED",
//           currentStage: "FAILED",
//         },
//       });

//       throw error;
//     }
//   },

//   {
//     connection: createRedisConnection(),

//     concurrency: 1,

//     lockDuration:
//       1000 * 60 * 30,

//     stalledInterval:
//       1000 * 60,

//     maxStalledCount: 3,
//   }
// );

// // ============================================================
// // WORKER EVENTS
// // ============================================================

// quizWorker.on(
//   "ready",
//   () => {
//     console.log(
//       "✅ Quiz worker connected to Redis"
//     );
//   }
// );

// quizWorker.on(
//   "active",
//   (job) => {
//     console.log(
//       `⚙️ Quiz job active: ${job.id}`
//     );
//   }
// );

// quizWorker.on(
//   "completed",
//   (job) => {
//     console.log(
//       `🎯 Quiz job completed: ${job.id}`
//     );
//   }
// );

// quizWorker.on(
//   "failed",
//   (job, err) => {
//     console.error(
//       `❌ Quiz job failed: ${job?.id}`
//     );

//     console.error(err);
//   }
// );

// quizWorker.on(
//   "error",
//   (err) => {
//     console.error(
//       "❌ Quiz worker connection error:"
//     );

//     console.error(err);
//   }
// );

// // ============================================================
// // SHUTDOWN
// // ============================================================

// process.on(
//   "SIGINT",
//   async () => {
//     console.log(
//       "Closing quiz worker..."
//     );

//     await quizWorker.close();

//     process.exit(0);
//   }
// );
