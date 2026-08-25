import { db } from "../../../lib/db.js";
import { buildStudentMemory } from "./buildStudentMemory.service.js";

export async function buildTutorContext(
  studentId
) {
  const memory =
    await buildStudentMemory(
      studentId
    );

  const summaries =
    await db.tutorSessionSummary.findMany({
      where: {
        studentId,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 5,
    });

  const topicProgress =
    await db.tutorTopicProgress.findMany({
      where: {
        studentId,
      },

      orderBy: {
        masteryScore: "desc",
      },

      take: 10,
    });

  const learningProfile =
    await db.tutorLearningProfile.findUnique({
      where: {
        studentId,
      },
    });

  const insights =
    await db.tutorLearningInsight.findUnique({
      where: {
        studentId,
      },
    });

    const recentSessions = summaries;

      const progressSummary =
        topicProgress.length > 0
          ? topicProgress
              .map(
                (topic) => `
                  Topic: ${topic.topic}
                  Subject: ${topic.subject || "Unknown"}
                  Mastery: ${topic.masteryScore}%

                  Strengths:
                  ${topic.strengths?.join(", ") || "None"}

                  Weaknesses:
                  ${topic.weaknesses?.join(", ") || "None"}
                  `
              )
              .join("\n")
          : "No topic progress available.";

      const learningInsights =
        insights
          ? `
          Strongest Subject:
          ${insights.strongestSubject || "Unknown"}

          Weakest Subject:
          ${insights.weakestSubject || "Unknown"}

          Average Mastery:
          ${insights.averageMastery || 0}%

          Top Strengths:
          ${insights.topStrengths?.join(", ") || "None"}

          Top Weaknesses:
          ${insights.topWeaknesses?.join(", ") || "None"}
          `
            : "No learning insights available.";

  return {
    memory,
    learningProfile,
    topicProgress,
    learningInsights: insights,
    recentSessions: summaries,
  };
}