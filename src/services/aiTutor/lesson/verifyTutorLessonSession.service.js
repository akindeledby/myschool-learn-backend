import { db } from "../../../../lib/db.js";

/**
 * Verifies that a TutorLessonSession belongs to:
 *
 * 1. The authenticated student.
 * 2. The supplied conversation.
 * 3. The lesson progress belonging to that student.
 *
 * This prevents a client from manually submitting another
 * student's lessonSessionId or attaching a lesson session
 * to the wrong conversation.
 *
 * @param {Object} params
 * @param {string} params.lessonSessionId
 * @param {string} params.studentId
 * @param {string} params.conversationId
 *
 * @returns {Promise<Object|null>}
 */
export async function verifyTutorLessonSession({
  lessonSessionId,
  studentId,
  conversationId,
}) {
  if (
    !lessonSessionId ||
    !studentId ||
    !conversationId
  ) {
    return null;
  }

  const session =
    await db.tutorLessonSession.findUnique({
      where: {
        id: lessonSessionId,
      },

      include: {
        lessonProgress: {
          select: {
            id: true,
            studentId: true,
            topicId: true,
            status: true,
            currentObjectiveId: true,
            currentStep: true,
            progressPercent: true,
          },
        },

        conversation: {
          select: {
            id: true,
            studentId: true,
          },
        },
      },
    });

  /*
   * Session does not exist.
   */
  if (!session) {
    return null;
  }

  /*
   * Make sure the session belongs to the supplied conversation.
   */
  if (
    session.conversationId !==
    conversationId
  ) {
    return null;
  }

  /*
   * Make sure the session itself belongs to the
   * authenticated student.
   */
  if (
    session.studentId !==
    studentId
  ) {
    return null;
  }

  /*
   * Make sure the lesson progress belongs to
   * the same student.
   */
  if (
    session.lessonProgress?.studentId !==
    studentId
  ) {
    return null;
  }

  /*
   * Make sure the conversation also belongs
   * to the same student.
   */
  if (
    session.conversation?.studentId !==
    studentId
  ) {
    return null;
  }

  /*
   * A session that has already ended should not
   * be used for continuing an active lesson.
   */
  if (session.endedAt) {
    return null;
  }

  /*
   * The lesson itself should still be active.
   *
   * We don't require a particular enum value here
   * unless your TutorLessonStatus enum is confirmed.
   */
  if (
    session.lessonProgress?.status ===
    "COMPLETED"
  ) {
    return null;
  }

  return session;
}