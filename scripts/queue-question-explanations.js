import { db } from "../lib/db.js";

import { questionExplanationQueue } from "../src/queues/question-explanation.queue.js";

// ============================================================
// QUEUE EXISTING QUESTIONS WITHOUT EXPLANATIONS
// ============================================================

async function queueQuestionExplanations() {
  console.log(
    "🔎 Searching for questions without explanations..."
  );

  try {
    const questions =
      await db.question.findMany({
        where: {
          OR: [
            {
              explanation: null,
            },

            {
              explanation: "",
            },
          ],
        },

        select: {
          id: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    console.log(
      `📚 Found ${questions.length} question(s) without explanations.`
    );

    if (questions.length === 0) {
      console.log(
        "✅ All questions already have explanations."
      );

      return;
    }

    let queuedCount = 0;

    // ========================================================
    // QUEUE JOBS
    // ========================================================

    for (const question of questions) {
      try {
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

        console.log(
          `📥 Queued question ${question.id}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to queue question ${question.id}`
        );

        console.error(error);
      }
    }

    console.log(
      "=========================================="
    );

    console.log(
      `📊 Total questions found: ${questions.length}`
    );

    console.log(
      `🚀 Successfully queued: ${queuedCount}`
    );

    console.log(
      `❌ Failed to queue: ${questions.length - queuedCount}`
    );

    console.log(
      "=========================================="
    );
  } finally {
    await db.$disconnect();
  }
}

// ============================================================
// RUN
// ============================================================

queueQuestionExplanations()
  .then(() => {
    console.log(
      "✅ Question explanation backfill completed."
    );

    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "❌ Question explanation backfill failed."
    );

    console.error(error);

    process.exit(1);
  });