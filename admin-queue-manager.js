import "dotenv/config";

import { lessonQueue } from "./src/queues/lesson.queue.js";
import { sceneQueue } from "./src/queues/scene.queue.js";
import { imageQueue } from "./src/queues/image.queue.js";
import { audioQueue } from "./src/queues/audio.queue.js";
import { renderQueue } from "./src/queues/render.queue.js";
import { hlsQueue } from "./src/queues/hls.queue.js";

// =====================================
// QUEUE MAP
// =====================================

const queues = {
  lesson: lessonQueue,
  scene: sceneQueue,
  image: imageQueue,
  audio: audioQueue,
  render: renderQueue,
  hls: hlsQueue,
};

// =====================================
// CLI ARGS
// =====================================

const action = process.argv[2];
const queueName = process.argv[3];
const extra = process.argv[4];

const queue = queues[queueName];

if (!queue) {
  console.log(
    "❌ Invalid queue name"
  );

  console.log(
    "Available queues:"
  );

  console.log(
    Object.keys(queues)
  );

  process.exit(1);
}

// =====================================
// ACTIONS
// =====================================

async function run() {
  try {
    switch (action) {
      // =====================================
      // PAUSE
      // =====================================

      case "pause":
        await queue.pause();

        console.log(
          `⏸ ${queueName} queue paused`
        );

        break;

      // =====================================
      // RESUME
      // =====================================

      case "resume":
        await queue.resume();

        console.log(
          `▶ ${queueName} queue resumed`
        );

        break;

      // =====================================
      // CLEAN FAILED
      // =====================================

      case "clean-failed":
        await queue.clean(
          0,
          0,
          "failed"
        );

        console.log(
          `🧹 Failed jobs cleaned from ${queueName}`
        );

        break;

      // =====================================
      // CLEAN COMPLETED
      // =====================================

      case "clean-completed":
        await queue.clean(
          0,
          0,
          "completed"
        );

        console.log(
          `🧹 Completed jobs cleaned from ${queueName}`
        );

        break;

      // =====================================
      // OBLITERATE
      // =====================================

      case "obliterate":
        await queue.obliterate({
          force: true,
        });

        console.log(
          `💥 ${queueName} queue obliterated`
        );

        break;

      // =====================================
      // RETRY FAILED JOBS
      // =====================================

      case "retry-failed":
        {
          const failedJobs =
            await queue.getFailed();

          for (const job of failedJobs) {
            await job.retry();

            console.log(
              `🔄 Retried job: ${job.id}`
            );
          }

          console.log(
            `✅ Failed jobs retried`
          );
        }

        break;

      // =====================================
      // REMOVE JOB
      // =====================================

      case "remove-job":
        {
          if (!extra) {
            throw new Error(
              "Provide job ID"
            );
          }

          const job =
            await queue.getJob(extra);

          if (!job) {
            throw new Error(
              "Job not found"
            );
          }

          await job.remove();

          console.log(
            `🗑 Removed job ${extra}`
          );
        }

        break;

      // =====================================
      // JOB COUNTS
      // =====================================

      case "stats":
        {
          const counts =
            await queue.getJobCounts();

          console.log(
            counts
          );
        }

        break;

      // =====================================
      // UNKNOWN
      // =====================================

      default:
        console.log(
          "❌ Unknown action"
        );

        console.log(`
          Available actions:

          pause
          resume
          clean-failed
          clean-completed
          obliterate
          retry-failed
          remove-job
          stats
        `);
    }

    process.exit(0);

  } catch (error) {
    console.error(error);

    process.exit(1);
  }
}

run();






// Examples:

// Pause render queue:

// node admin-queue-manager.js pause render

// Resume:

// node admin-queue-manager.js resume render

// Clean failed jobs:

// node admin-queue-manager.js clean-failed render

// Retry failed jobs:

// node admin-queue-manager.js retry-failed render

// Show stats:

// node admin-queue-manager.js stats render

// Obliterate queue:

// node admin-queue-manager.js obliterate render

// Remove specific job:

// node admin-queue-manager.js remove-job render 123