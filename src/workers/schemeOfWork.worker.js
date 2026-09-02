import { Worker } from "bullmq";
import axios from "axios";

import { db } from "../../lib/db.js";
import { createRedisConnection } from "../../lib/redis.js";
import { extractSchemeOfWork } from "../services/schemeOfWork/extractSchemeOfWork.js";
import { validateSchemeOfWork } from "../utils/validateSchemeOfWork.js";
import { saveSchemeOfWork } from "../utils/saveSchemeOfWork.js";


export const schemeOfWorkWorker = new Worker(
  "schemeOfWork",

  async (job) => {
    const {
      schemeOfWorkId,
      fileLink,
      userId,
    } = job.data;

    try {
      console.log(`🚀 Starting job: ${schemeOfWorkId}`);

      // 🔍 CHECK IF schemeOfWork EXISTS
      const existing = await db.schemeOfWork.findUnique({
        where: {
          id: schemeOfWorkId,
        },
      });

      if (!existing) {
        throw new Error(
          `Scheme Of Work not found: ${schemeOfWorkId}`
        );
      }

      // ⚡ SKIP IF ALREADY PROCESSING OR COMPLETED
      if (
        // existing.processingStatus === "PROCESSING" ||
        existing.processingStatus === "COMPLETED"
      ) {
        console.log(
          `⚡ Skipping already processed scheme of work: ${schemeOfWorkId}`
        );

        return;
      }

      // ✅ UPDATE STATUS TO PROCESSING
      await db.schemeOfWork.update({
        where: {
          id: schemeOfWorkId,
        },
        data: {
          processingStatus: "PROCESSING",
        },
      });

      console.log(`🔄 PROCESSING: ${schemeOfWorkId}`);

      // ⬇️ DOWNLOAD PDF FROM CLOUDINARY
      let pdfBuffer;

      try {
        console.log(
          "⬇️ Downloading PDF from Cloudinary..."
        );

        console.log("🔗 URL:", fileLink);

        const response = await axios({
          method: "get",
          url: fileLink,
          responseType: "arraybuffer",
          timeout: 30000,
        });

        pdfBuffer = Buffer.from(response.data);

        console.log(
          `✅ PDF downloaded successfully (${pdfBuffer.length} bytes)`
        );

      } catch (downloadError) {
        console.error(
          "❌ Failed to download PDF"
        );

        if (downloadError.response) {
          console.error(
            "📡 Status:",
            downloadError.response.status
          );

          console.error(
            "📄 Response:",
            downloadError.response.data
          );
        }

        console.error(
          "🧾 Error Message:",
          downloadError.message
        );

        console.error(
          "🔗 Failed URL:",
          fileLink
        );

        throw new Error(
          "Could not download scheme of work PDF"
        );
      }

      // 🧠 SEND PDF TO GEMINI
      console.log(
        "🧠 Sending scheme of work to Gemini..."
      );

      const extracted =
        await extractSchemeOfWork(pdfBuffer);

      console.log(
        "✅ schemeOfWork extraction complete"
      );

      // 🔍 VALIDATE AI OUTPUT
      console.log(
        "🔍 Validating scheme of work structure..."
      );

      const validated =
        validateSchemeOfWork(extracted);

      console.log(
        "✅ scheme of work validation complete"
      );

      // 💾 SAVE TO DATABASE
      console.log(
        "💾 Saving Scheme of work content..."
      );

      await saveSchemeOfWork(
        validated,
        schemeOfWorkId
      );

      console.log(
        "✅ Scheme of work saved successfully"
      );

      // 🎯 MARK AS COMPLETED
      await db.schemeOfWork.update({
        where: {
          id: schemeOfWorkId,
        },
        data: {
          processingStatus: "COMPLETED",
        },
      });

      console.log(
        `🎉 Completed scheme of work job: ${schemeOfWorkId}`
      );

    } catch (error) {
      console.error(
        `❌ Failed scheme of work job: ${schemeOfWorkId}`
      );

      console.error(error);

      // ❌ MARK AS FAILED
      await db.schemeOfWork.update({
        where: {
          id: schemeOfWorkId,
        },
        data: {
          processingStatus: "FAILED",
        },
      });

      throw error;
    }
  },
  { connection: createRedisConnection() }
);

// ✅ WORKER EVENTS
schemeOfWorkWorker.on("ready", () => {
  console.log(
    "✅ Scheme Of Work worker connected to Redis"
  );
});

schemeOfWorkWorker.on("active", (job) => {
  console.log(
    `⚙️ Job active: ${job.id}`
  );
});

schemeOfWorkWorker.on("completed", (job) => {
  console.log(
    `🎯 Job completed: ${job.id}`
  );
});

schemeOfWorkWorker.on("failed", (job, err) => {
  console.error(
    `❌ Job failed: ${job?.id}`
  );

  console.error(err);
});

schemeOfWorkWorker.on("error", (err) => {
  console.error(
    "❌ Worker connection error:"
  );

  console.error(err);
});

process.on("SIGINT", async () => {
  console.log(
    "Closing Scheme Of Work worker..."
  );

  await schemeOfWorkWorker.close();

  process.exit(0);
});