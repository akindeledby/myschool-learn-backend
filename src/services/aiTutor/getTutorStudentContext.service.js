
import { db } from "../../../lib/db.js";
import { buildTutorContext } from "../../services/elevenLabs/tutorContext.service.js";

/**
 * Loads the student context required by the AI Tutor.
 *
 * This service combines:
 *
 * 1. Basic student information required for personalization.
 * 2. The existing general Tutor context returned by buildTutorContext().
 *
 * It intentionally does NOT load curriculum lesson state.
 *
 * Curriculum-specific state is handled separately by:
 *
 *    TutorLessonProgress
 *    TutorObjectiveProgress
 *    TutorLessonSession
 *    TutorLessonMemory
 *
 * @param {string} studentId
 * @returns {Promise<Object>}
 */
export async function getTutorStudentContext(studentId) {
  if (!studentId) {
    const error = new Error("studentId is required.");
    error.statusCode = 400;
    throw error;
  }

  /*
   * The student record and general Tutor context are independent,
   * so load them concurrently.
   */
  const [student, tutorContext] = await Promise.all([
    db.student.findUnique({
      where: {
        id: studentId,
      },

      select: {
        id: true,

        firstName: true,
        lastName: true,

        age: true,
        classLevel: true,

        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

    buildTutorContext(studentId),
  ]);

  /*
   * The student must exist before the lesson can continue.
   */
  if (!student) {
    const error = new Error("Student not found.");
    error.statusCode = 404;
    throw error;
  }

  /*
   * Return only the context required by downstream Tutor services.
   *
   * Keep the general Tutor context separate from the student's
   * identity information. This makes the structure predictable
   * for buildLessonTeachingPrompt().
   */
  return {
    student,

    memory:
      tutorContext.memory || null,

    learningProfile:
      tutorContext.learningProfile || null,

    learningInsight:
      tutorContext.learningInsights || null,

    topicProgress:
      tutorContext.topicProgress || [],

    recentSessions:
      tutorContext.recentSessions || [],
  };
}
