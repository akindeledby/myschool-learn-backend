import { db } from "../../lib/db.js";

export async function getVideoLesson(
  req,
  res
) {
  try {
    const { topicId } =
      req.params;

    const topic =
      await db.topic.findUnique({
        where: {
          id: topicId,
        },

        select: {
          id: true,
          title: true,
          hlsUrl: true,
          status: true,
        },
      });

    if (!topic) {
      return res.status(404).json({
        message:
          "Video lesson not found",
      });
    }

    if (!topic.hlsUrl) {
      return res.status(400).json({
        message:
          "Video not ready",
      });
    }

    res.json(topic);
  } catch (error) {
    res.status(500).json({
      message:
        "Failed to fetch lesson",
    });
  }
}