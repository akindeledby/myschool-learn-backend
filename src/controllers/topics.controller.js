import { db } from "../../lib/db.js";

export async function getTopicsBySubject(
  req,
  res
) {
  try {
    const { subjectId } = req.params;

    if(!subjectId) {
      return res.status(401).json({
        success: false,
        message: "SubjectId is required",
      });
    }

    const topics =
      await db.topic.findMany({
        where: {
          subjectId,
          status: "COMPLETED",
        },

        select: {
          id: true,
          title: true,
          hlsUrl: true,
        },
      });

    res.json(topics);
  } catch (error) {
    res.status(500).json({
      message:
        "Failed to fetch topics",
    });
  }
}