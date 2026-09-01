import { db } from "../../lib/db.js";
import { schemeOfWorkQueue } from "../queues/schemeOfWork.queue.js";

export async function uploadPDF(req, res) {
  try {
    const userId = req.user.userId;
    const { fileLink, classLevel, schemeOfWorkYear, noOfPages } = req.body;

    if (!fileLink) {
      return res.status(400).json({
        error: "File link is required",
      });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });

    const schemeOfWorkData = {
      classLevel,
      fileLink,
      schemeOfWorkYear,
      noOfPages: Number(noOfPages),
      processingStatus: "PENDING",

      uploadedBy: {
        connect: {
          id: req.user.userId,
        },
      },
    };

    // attach school ONLY if it exists
    if (user?.schoolId) {
      schemeOfWorkData.school = {
        connect: {
          id: user.schoolId,
        },
      };
    }

    const schemeOfWork = await db.schemeOfWork.create({
      data: schemeOfWorkData,
    });

    await schemeOfWorkQueue.add(
      "process-schemeOfWork",
      {
        schemeOfWorkId: schemeOfWork.id,
        fileLink,
        // userId: req.user.userId,
        userId,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    return res.json({
      success: true,
      message:
        "SchemeOfWork uploaded successfully and processing started.",
      schemeOfWorkId:  schemeOfWork.id,
      processingStatus:  schemeOfWork.processingStatus,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Upload failed",
    });
  }
}
