
import { db } from "../../../lib/db.js";

/**
 * Finalizes a TutorLessonSession.
 *
 * This service records the student's final position when a
 * curriculum lesson session ends.
 *
 * It records:
 *
 *   endedAt
 *   durationSeconds
 *   endingObjectiveId
 *   endingStep
 *
 * It also keeps TutorLessonProgress synchronized with the
 * student's most recent position.
 *
 * The service is intentionally separate from the streaming
 * service so that ending a lesson does not make the streaming
 * code responsible for session management.
 *
 * Important:
 *
 * This operation is designed to be idempotent.
 *
 * If the session has already been ended, the original session
 * ending information is preserved.
 *
 * @param {Object} params
 * @param {string} params.lessonSessionId
 * @param {string} [params.endingObjectiveId]
 * @param {number} [params.endingStep]
 *
 * @returns {Promise<Object>} Finalized TutorLessonSession
 */
export async function endTutorLessonSession({
  lessonSessionId,
  endingObjectiveId,
  endingStep,
}) {
  /*
   * ============================================================
   * VALIDATION
   * ============================================================
   */

  if (!lessonSessionId) {
    const error = new Error(
      "A valid lessonSessionId is required."
    );

    error.statusCode = 400;

    throw error;
  }

  /*
   * ============================================================
   * NORMALIZE ENDING STEP
   * ============================================================
   */

  const normalizedEndingStep =
    Number.isInteger(endingStep) &&
    endingStep >= 0
      ? endingStep
      : null;

  /*
   * ============================================================
   * LOAD SESSION
   * ============================================================
   *
   * We deliberately load the lesson progress as well.
   *
   * The database is the final source of truth for the student's
   * current position.
   */

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
   * IDEMPOTENCY
   * ============================================================
   *
   * A browser may send the end request more than once.
   *
   * For example:
   *
   *   Student clicks Finish
   *          ↓
   *   request sent
   *          ↓
   *   browser retries
   *
   * We must not create a second ending state.
   */

  if (session.endedAt) {
    return session;
  }

  /*
   * ============================================================
   * DETERMINE FINAL POSITION
   * ============================================================
   *
   * If the caller explicitly supplies the ending objective,
   * use it.
   *
   * Otherwise use the current objective stored on
   * TutorLessonProgress.
   */

  const finalObjectiveId =
    endingObjectiveId ||
    session.lessonProgress
      ?.currentObjectiveId ||
    null;

  /*
   * Likewise, use the explicitly supplied step when available.
   * Otherwise use the persistent lesson progress step.
   */

  const finalStep =
    normalizedEndingStep !== null
      ? normalizedEndingStep
      : Number.isInteger(
          session.lessonProgress?.currentStep
        )
        ? session.lessonProgress.currentStep
        : 0;

  /*
   * ============================================================
   * CALCULATE DURATION
   * ============================================================
   *
   * Duration is calculated from the session's actual startedAt
   * rather than relying on the frontend.
   *
   * This prevents a client from submitting an arbitrary duration.
   */

  const endedAt = new Date();

  const startedAt =
    session.startedAt || endedAt;

  const durationMilliseconds =
    endedAt.getTime() -
    startedAt.getTime();

  const durationSeconds = Math.max(
    0,
    Math.floor(
      durationMilliseconds / 1000
    )
  );

  /*
   * ============================================================
   * FINALIZE SESSION AND SYNCHRONIZE PROGRESS
   * ============================================================
   *
   * Both operations belong together.
   *
   * If session finalization succeeds but lesson progress
   * synchronization fails, the database could become inconsistent.
   *
   * Therefore use a transaction.
   */

  const finalizedSession =
    await db.$transaction(
      async (tx) => {
        /*
         * --------------------------------------------
         * Re-check the session inside the transaction.
         * --------------------------------------------
         *
         * This protects against two requests attempting to
         * finalize the same session simultaneously.
         */

        const currentSession =
          await tx.tutorLessonSession.findUnique({
            where: {
              id: lessonSessionId,
            },

            select: {
              id: true,
              endedAt: true,
              lessonProgressId: true,
            },
          });

        if (!currentSession) {
          const error = new Error(
            "Tutor lesson session could not be found."
          );

          error.statusCode = 404;

          throw error;
        }

        /*
         * Another request may have finalized it while this
         * transaction was starting.
         *
         * Return the existing record rather than overwriting it.
         */

        if (currentSession.endedAt) {
          return tx.tutorLessonSession.findUnique({
            where: {
              id: lessonSessionId,
            },

            include: {
              lessonProgress: true,
            },
          });
        }

        /*
         * --------------------------------------------
         * Finalize the lesson session.
         * --------------------------------------------
         */

        const updatedSession =
          await tx.tutorLessonSession.update({
            where: {
              id: lessonSessionId,
            },

            data: {
              endedAt,

              durationSeconds,

              endingObjectiveId:
                finalObjectiveId,

              endingStep:
                finalStep,
            },

            include: {
              lessonProgress: true,

              conversation: true,
            },
          });

        /*
         * --------------------------------------------
         * Synchronize lesson progress.
         * --------------------------------------------
         *
         * We intentionally do NOT automatically mark the
         * lesson as COMPLETED merely because the session ended.
         *
         * Leaving a lesson is not the same thing as completing
         * the lesson.
         *
         * Completion is determined by the objective progress
         * system.
         */

        await tx.tutorLessonProgress.update({
          where: {
            id: currentSession.lessonProgressId,
          },

          data: {
            currentObjectiveId:
              finalObjectiveId,

            currentStep:
              finalStep,

            lastAccessedAt:
              endedAt,
          },
        });

        return updatedSession;
      }
    );

  /*
   * ============================================================
   * RETURN FINAL SESSION
   * ============================================================
   */

  return finalizedSession;
}
