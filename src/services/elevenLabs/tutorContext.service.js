
import { db } from "../../../lib/db.js";
import { buildStudentMemory } from "./buildStudentMemory.service.js";


export async function buildTutorContext(studentId) {
  if (!studentId) {
    const error = new Error("studentId is required.");
    error.statusCode = 400;
    throw error;
  }

  /*
   * Load independent pieces of Tutor context concurrently.
   *
   * buildStudentMemory() contains the existing conversational
   * memory logic used by the general Tutor.
   */
  const [
    memory,
    summaries,
    topicProgress,
    learningProfile,
    learningInsight,
  ] = await Promise.all([
    buildStudentMemory(studentId),

    db.tutorSessionSummary.findMany({
      where: {
        studentId,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 5,
    }),

    db.tutorTopicProgress.findMany({
      where: {
        studentId,
      },

      orderBy: [
        {
          masteryScore: "desc",
        },
        {
          lastStudiedAt: "desc",
        },
      ],

      take: 10,
    }),

    db.tutorLearningProfile.findUnique({
      where: {
        studentId,
      },
    }),

    db.tutorLearningInsight.findUnique({
      where: {
        studentId,
      },
    }),
  ]);


  return {
    memory: memory || null,

    recentSessions: summaries || [],

    topicProgress: topicProgress || [],

    learningProfile: learningProfile || null,

    learningInsight: learningInsight || null,
  };
}
