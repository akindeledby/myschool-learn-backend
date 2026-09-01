
import { db } from "../../../lib/db.js";

/**
 * Creates an event within a TutorLessonSession.
 *
 * TutorLessonEvent is an activity log for the curriculum Tutor.
 *
 * It records meaningful events such as:
 *
 *   LESSON_STARTED
 *   OBJECTIVE_STARTED
 *   TEACHING_STEP_COMPLETED
 *   QUESTION_ANSWERED
 *   OBJECTIVE_COMPLETED
 *   OBJECTIVE_SKIPPED
 *   LESSON_PAUSED
 *   LESSON_RESUMED
 *   LESSON_COMPLETED
 *
 * This service is intentionally independent from:
 *
 *   updateTutorLessonProgress()
 *   updateTutorLessonMemory()
 *   endTutorLessonSession()
 *   streamTutorLesson()
 *
 * Those services are responsible for changing state.
 *
 * This service records what happened.
 *
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.type
 * @param {string} [params.objectiveId]
 * @param {number} [params.step]
 * @param {Object|Array|string|number|boolean|null} [params.data]
 *
 * @returns {Promise<Object>} Created TutorLessonEvent
 */
export async function createTutorLessonEvent({
  sessionId,
  type,
  objectiveId,
  step,
  data,
}) {
  /*
   * ============================================================
   * VALIDATE SESSION
   * ============================================================
   */

  if (!sessionId) {
    const error = new Error(
      "A valid sessionId is required."
    );

    error.statusCode = 400;

    throw error;
  }

  /*
   * ============================================================
   * VALIDATE EVENT TYPE
   * ============================================================
   *
   * Prisma will ultimately validate the enum as well, but doing
   * basic validation here gives the application a clearer error.
   *
   * Keep this list synchronized with TutorLessonEventType in
   * schema.prisma.
   */

  const allowedEventTypes = new Set([
    "LESSON_STARTED",
    "OBJECTIVE_STARTED",
    "TEACHING_STEP_COMPLETED",
    "QUESTION_ANSWERED",
    "OBJECTIVE_COMPLETED",
    "OBJECTIVE_SKIPPED",
    "LESSON_PAUSED",
    "LESSON_RESUMED",
    "LESSON_COMPLETED",
  ]);

  if (
    !type ||
    !allowedEventTypes.has(type)
  ) {
    const error = new Error(
      `Invalid tutor lesson event type: ${type || "undefined"}.`
    );

    error.statusCode = 400;

    throw error;
  }

  /*
   * ============================================================
   * VALIDATE STEP
   * ============================================================
   */

  let normalizedStep = null;

  if (step !== undefined && step !== null) {
    if (
      !Number.isInteger(step) ||
      step < 0
    ) {
      const error = new Error(
        "step must be a non-negative integer."
      );

      error.statusCode = 400;

      throw error;
    }

    normalizedStep = step;
  }

  /*
   * ============================================================
   * VERIFY SESSION
   * ============================================================
   *
   * We verify the session before creating the event.
   *
   * This also gives us the lesson progress relationship so that
   * we can verify the objective belongs to the same lesson.
   */

  const session =
    await db.tutorLessonSession.findUnique({
      where: {
        id: sessionId,
      },

      select: {
        id: true,

        studentId: true,

        lessonProgressId: true,

        endedAt: true,

        lessonProgress: {
          select: {
            id: true,
            topicId: true,
          },
        },
      },
    });

  if (!session) {
    const error = new Error(
      "Tutor lesson session could not be found."
    );

    error.statusCode = 404;

    throw error;
  }

  /*
   * ============================================================
   * VALIDATE OBJECTIVE
   * ============================================================
   *
   * An event can exist without an objective.
   *
   * For example:
   *
   *   LESSON_STARTED
   *   LESSON_PAUSED
   *   LESSON_RESUMED
   *
   * But if objectiveId is supplied, make sure that objective
   * belongs to the same topic as this lesson session.
   */

  if (objectiveId) {
    const objective =
      await db.topicObjective.findFirst({
        where: {
          id: objectiveId,

          topicId:
            session.lessonProgress.topicId,
        },

        select: {
          id: true,
        },
      });

    if (!objective) {
      const error = new Error(
        "The supplied objective does not belong to this lesson."
      );

      error.statusCode = 400;

      throw error;
    }
  }

  /*
   * ============================================================
   * NORMALIZE EVENT DATA
   * ============================================================
   *
   * Prisma Json fields should not receive undefined.
   *
   * null is acceptable and represents an event with no
   * additional metadata.
   */

  const eventData =
    data === undefined
      ? undefined
      : data;

  /*
   * ============================================================
   * CREATE EVENT
   * ============================================================
   */

  const event =
    await db.tutorLessonEvent.create({
      data: {
        sessionId,

        type,

        objectiveId:
          objectiveId || null,

        step:
          normalizedStep,

        data:
          eventData,
      },
    });

  return event;
}
