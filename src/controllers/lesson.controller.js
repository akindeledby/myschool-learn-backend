import { db } from "../../lib/db.js";
import { lessonQueue } from "../queues/lesson.queue.js";

export async function generateLessonHandler(req, res) {
  try {
    const { topicId } = req.body;

    const user = await db.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({
        error: "Unauthorized",
      });
    }

    // FIXED VALIDATION
    if (!topicId) {
      return res.status(400).json({
        error: "topicId is required",
      });
    }

    const topic = await db.topic.findUnique({
      where: { id: topicId },
      select: {
        status: true,
        hlsUrl: true,
      },
    });

    if (!topic) {
      return res.status(404).json({
        error: "Topic not found",
      });
    }

    if (topic.status === "PROCESSING") {
      return res.status(400).json({
        error: "Lesson generation already in progress",
      });
    }

    if (topic.currentStage === "COMPLETED" || topic.status === "COMPLETED" && topic.hlsUrl) {
      return res.status(400).json({
        error: "Lesson already generated",
      });
    }

    await db.topic.update({
      where: { id: topicId },
      data: {
        status: "PROCESSING",
        progress: 0,
      },
    });

    await lessonQueue.add(
      "generate-topic-video",
      { topicId },
      {
        jobId: topicId,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 20,
        removeOnFail: false,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Video lesson generation started",
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to start lesson generation",
    });
  }
}


export async function getTopicStatus(req, res) {
  try {
    const { id } = req.params;

    const topic = await db.topic.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!topic) {
      return res.status(404).json({ message: "Topic Not found" });
    }

    res.json(topic);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}