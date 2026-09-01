import { db } from "../../../lib/db.js";

/**
 * Updates persistent AI Tutor lesson progress.
 *
 * Supports:
 *
 * 1. Recording a student attempt.
 * 2. Updating mastery.
 * 3. Completing an objective after teaching.
 * 4. Moving to the next objective.
 * 5. Completing the entire lesson.
 *
 * The transaction is deliberately kept small.
 *
 * No AI calls, summaries, analytics, memory generation,
 * achievements, or large relation loads should happen here.
 */
export async function updateTutorLessonProgress({
  lessonProgressId,
  objectiveId,
  isCorrect = false,
  masteryScore,
  completeObjective = false,
  recordAttempt = true,
}) {
  /*
  ============================================================
  VALIDATION
  ============================================================
  */

  if (!lessonProgressId) {
    const error = new Error(
      "A valid lesson progress ID is required."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!objectiveId) {
    const error = new Error(
      "A valid objective ID is required."
    );

    error.statusCode = 400;

    throw error;
  }

  if (typeof isCorrect !== "boolean") {
    const error = new Error(
      "isCorrect must be a boolean."
    );

    error.statusCode = 400;

    throw error;
  }

  /*
  ============================================================
  NORMALIZE MASTERY
  ============================================================
  */

  let normalizedMasteryScore = null;

  if (
    masteryScore !== undefined &&
    masteryScore !== null
  ) {
    const numericScore =
      Number(masteryScore);

    if (!Number.isFinite(numericScore)) {
      const error = new Error(
        "masteryScore must be a valid number."
      );

      error.statusCode = 400;

      throw error;
    }

    normalizedMasteryScore = Math.min(
      100,
      Math.max(0, numericScore)
    );
  }

  /*
  ============================================================
  TRANSACTION
  ============================================================
  */

  const result = await db.$transaction(
    async (tx) => {
      /*
      ----------------------------------------------------------
      LOAD LESSON
      ----------------------------------------------------------
      */

      const lessonProgress =
        await tx.tutorLessonProgress.findUnique({
          where: {
            id: lessonProgressId,
          },

          select: {
            id: true,
            topicId: true,
            currentObjectiveId: true,
            currentStep: true,
            status: true,
            startedAt: true,
          },
        });

      if (!lessonProgress) {
        const error = new Error(
          "Tutor lesson progress could not be found."
        );

        error.statusCode = 404;

        throw error;
      }

      /*
      ----------------------------------------------------------
      VERIFY CURRENT OBJECTIVE
      ----------------------------------------------------------
      */

      if (
        lessonProgress.currentObjectiveId &&
        lessonProgress.currentObjectiveId !==
          objectiveId
      ) {
        const error = new Error(
          "The supplied objective is not the student's current lesson objective."
        );

        error.statusCode = 409;

        throw error;
      }

      /*
      ----------------------------------------------------------
      VERIFY OBJECTIVE BELONGS TO TOPIC
      ----------------------------------------------------------
      */

      const objective =
        await tx.topicObjective.findFirst({
          where: {
            id: objectiveId,
            topicId: lessonProgress.topicId,
          },

          select: {
            id: true,
            topicId: true,
            order: true,
          },
        });

      if (!objective) {
        const error = new Error(
          "Lesson objective could not be found."
        );

        error.statusCode = 404;

        throw error;
      }

      /*
      ----------------------------------------------------------
      FIND OBJECTIVE PROGRESS
      ----------------------------------------------------------
      */

      let objectiveProgress =
        await tx.tutorObjectiveProgress.findUnique({
          where: {
            lessonProgressId_objectiveId: {
              lessonProgressId:
                lessonProgress.id,

              objectiveId,
            },
          },

          select: {
            id: true,
            status: true,
            attempts: true,
            correctAttempts: true,
            masteryScore: true,
            startedAt: true,
            completedAt: true,
          },
        });

      /*
      ----------------------------------------------------------
      CREATE IF NECESSARY
      ----------------------------------------------------------
      */

      if (!objectiveProgress) {
        objectiveProgress =
          await tx.tutorObjectiveProgress.create({
            data: {
              lessonProgressId:
                lessonProgress.id,

              objectiveId,

              status:
                "IN_PROGRESS",

              attempts: 0,

              correctAttempts: 0,

              masteryScore: 0,

              startedAt:
                new Date(),
            },

            select: {
              id: true,
              status: true,
              attempts: true,
              correctAttempts: true,
              masteryScore: true,
              startedAt: true,
              completedAt: true,
            },
          });
      }

      /*
      ----------------------------------------------------------
      IDEMPOTENCY
      ----------------------------------------------------------
      */

      if (
        objectiveProgress.status ===
        "COMPLETED"
      ) {
        return {
          lessonProgressId:
            lessonProgress.id,

          objectiveId,

          objectiveCompleted: true,

          objectiveAlreadyCompleted: true,

          lessonCompleted:
            lessonProgress.status ===
            "COMPLETED",

          currentObjectiveId:
            lessonProgress.currentObjectiveId,

          currentStep:
            lessonProgress.currentStep,

          progressPercent:
            lessonProgress.status ===
            "COMPLETED"
              ? 100
              : null,

          nextObjectiveId: null,
        };
      }

      /*
      ----------------------------------------------------------
      CALCULATE ATTEMPTS
      ----------------------------------------------------------
      */

      const attempts =
        recordAttempt
          ? objectiveProgress.attempts + 1
          : objectiveProgress.attempts;

      const correctAttempts =
        recordAttempt
          ? objectiveProgress.correctAttempts +
            (isCorrect ? 1 : 0)
          : objectiveProgress.correctAttempts;

      /*
      ----------------------------------------------------------
      CALCULATE MASTERY
      ----------------------------------------------------------
      */

      let nextMasteryScore =
        objectiveProgress.masteryScore || 0;

      if (
        normalizedMasteryScore !== null
      ) {
        nextMasteryScore =
          normalizedMasteryScore;
      } else if (
        recordAttempt &&
        attempts > 0
      ) {
        nextMasteryScore =
          Math.round(
            (
              correctAttempts /
              attempts
            ) * 100
          );
      }

      /*
      ----------------------------------------------------------
      DETERMINE COMPLETION
      ----------------------------------------------------------
      */

      const OBJECTIVE_MASTERY_THRESHOLD =
        80;

      const objectiveCompleted =
        completeObjective ||
        nextMasteryScore >=
          OBJECTIVE_MASTERY_THRESHOLD;

      /*
      ----------------------------------------------------------
      UPDATE OBJECTIVE
      ----------------------------------------------------------
      */

      await tx.tutorObjectiveProgress.update({
        where: {
          id:
            objectiveProgress.id,
        },

        data: {
          status:
            objectiveCompleted
              ? "COMPLETED"
              : "IN_PROGRESS",

          attempts,

          correctAttempts,

          masteryScore:
            nextMasteryScore,

          startedAt:
            objectiveProgress.startedAt ||
            new Date(),

          completedAt:
            objectiveCompleted
              ? (
                  objectiveProgress.completedAt ||
                  new Date()
                )
              : null,
        },
      });

      /*
      ----------------------------------------------------------
      GET COMPLETED OBJECTIVE COUNT
      ----------------------------------------------------------
      */

      const completedCount =
        await tx.tutorObjectiveProgress.count({
          where: {
            lessonProgressId:
              lessonProgress.id,

            status:
              "COMPLETED",
          },
        });

      /*
      ----------------------------------------------------------
      GET TOTAL OBJECTIVES
      ----------------------------------------------------------
      */

      const totalObjectives =
        await tx.topicObjective.count({
          where: {
            topicId:
              lessonProgress.topicId,
          },
        });

      /*
      ----------------------------------------------------------
      GET NEXT OBJECTIVE
      ----------------------------------------------------------
      */

      const nextObjective =
        objectiveCompleted
          ? await tx.topicObjective.findFirst({
              where: {
                topicId:
                  lessonProgress.topicId,

                order: {
                  gt:
                    objective.order,
                },
              },

              orderBy: {
                order: "asc",
              },

              select: {
                id: true,
              },
            })
          : null;

      /*
      ----------------------------------------------------------
      LESSON COMPLETION
      ----------------------------------------------------------
      */

      const lessonCompleted =
        totalObjectives > 0 &&
        completedCount >=
          totalObjectives;

      const progressPercent =
        totalObjectives > 0
          ? Math.round(
              (
                completedCount /
                totalObjectives
              ) * 100
            )
          : 0;

      /*
      ----------------------------------------------------------
      NEXT OBJECTIVE
      ----------------------------------------------------------
      */

      const currentObjectiveId =
        lessonCompleted
          ? objectiveId
          : (
              nextObjective?.id ||
              objectiveId
            );

      const currentStep =
        objectiveCompleted &&
        nextObjective
          ? 0
          : (
              Number.isInteger(
                lessonProgress.currentStep
              )
                ? lessonProgress.currentStep
                : 0
            );

      /*
      ----------------------------------------------------------
      UPDATE LESSON
      ----------------------------------------------------------
      */

      const updatedLesson =
        await tx.tutorLessonProgress.update({
          where: {
            id:
              lessonProgress.id,
          },

          data: {
            status:
              lessonCompleted
                ? "COMPLETED"
                : "IN_PROGRESS",

            currentObjectiveId,

            currentStep,

            progressPercent,

            startedAt:
              lessonProgress.startedAt ||
              new Date(),

            lastAccessedAt:
              new Date(),

            completedAt:
              lessonCompleted
                ? new Date()
                : null,
          },

          select: {
            id: true,
            currentObjectiveId: true,
            currentStep: true,
            progressPercent: true,
            status: true,
            startedAt: true,
            lastAccessedAt: true,
            completedAt: true,
          },
        });

      /*
      ----------------------------------------------------------
      RETURN SMALL RESULT
      ----------------------------------------------------------
      */

      return {
        lessonProgress:
          updatedLesson,

        objectiveId,

        objectiveCompleted,

        objectiveAlreadyCompleted:
          false,

        lessonCompleted,

        currentObjectiveId:
          updatedLesson.currentObjectiveId,

        currentStep:
          updatedLesson.currentStep,

        progressPercent:
          updatedLesson.progressPercent,

        status:
          updatedLesson.status,

        nextObjectiveId:
          nextObjective?.id ||
          null,

        completedObjectives:
          completedCount,

        totalObjectives,
      };
    }
  );

  /*
  ============================================================
  LOAD OBJECTIVE OUTSIDE TRANSACTION
  ============================================================
  */

  const [objective, nextObjective] =
    await Promise.all([
      db.topicObjective.findUnique({
        where: {
          id:
            result.objectiveId,
        },
      }),

      result.nextObjectiveId
        ? db.topicObjective.findUnique({
            where: {
              id:
                result.nextObjectiveId,
            },
          })
        : Promise.resolve(null),
    ]);

  /*
  ============================================================
  RETURN
  ============================================================
  */

  return {
    lessonProgress:
      result.lessonProgress,

    objectiveProgress: null,

    objective,

    nextObjective,

    objectiveCompleted:
      result.objectiveCompleted,

    objectiveAlreadyCompleted:
      result.objectiveAlreadyCompleted,

    lessonCompleted:
      result.lessonCompleted,

    completedObjectives:
      result.completedObjectives,

    totalObjectives:
      result.totalObjectives,

    progressPercent:
      result.progressPercent,
  };
}
