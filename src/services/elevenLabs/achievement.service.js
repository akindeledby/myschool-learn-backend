

import { db } from "../../../lib/db.js";

async function awardAchievement({
  studentId,
  code,
}) {
  const definition =
    await db.achievementDefinition.findUnique({
      where: {
        code,
      },
    });

  if (!definition) {
    return;
  }

  const existing =
    await db.studentAchievement.findFirst({
      where: {
        studentId,
        achievementId:
          definition.id,
      },
    });

  if (existing) {
    return;
  }

  await db.studentAchievement.create({
    data: {
      studentId,
      achievementId:
        definition.id,
      earnedAt:
        new Date(),
    },
  });
}

export async function checkAchievements(
  studentId
) {
  try {
    const conversationCount =
      await db.tutorConversation.count({
        where: {
          studentId,
        },
      });

    if (conversationCount >= 1) {
      await awardAchievement({
        studentId,
        code:
          "FIRST_CONVERSATION",
      });
    }

    const masteredTopics =
      await db.tutorTopicProgress.count({
        where: {
          studentId,

          masteryScore: {
            gte: 80,
          },
        },
      });

    if (masteredTopics >= 1) {
      await awardAchievement({
        studentId,
        code:
          "TOPIC_MASTER",
      });
    }

    if (masteredTopics >= 5) {
      await awardAchievement({
        studentId,
        code:
          "SUBJECT_EXPERT",
      });
    }

    const summaries =
      await db.tutorSessionSummary.count({
        where: {
          studentId,
        },
      });

    if (summaries >= 10) {
      await awardAchievement({
        studentId,
        code:
          "DEDICATED_LEARNER",
      });
    }
  } catch (error) {
    console.error(
      "Achievement error:",
      error
    );
  }
}