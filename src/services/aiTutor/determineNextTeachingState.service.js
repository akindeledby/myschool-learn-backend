
import { db } from "../../../lib/db.js";

/**
 * Determines exactly where the AI Tutor should continue teaching
 * a student's curriculum lesson.
 *
 * This service is responsible ONLY for lesson progression state.
 *
 * It does not:
 *
 * 1. Fetch the student's learning profile.
 * 2. Fetch the student's learning insights.
 * 3. Build the AI prompt.
 * 4. Generate AI content.
 * 5. Start streaming.
 *
 * It is responsible for:
 *
 * 1. Reading the current TutorLessonProgress.
 * 2. Reading the student's objective progress.
 * 3. Determining the next incomplete objective.
 * 4. Creating TutorObjectiveProgress when necessary.
 * 5. Detecting whether the lesson is being resumed.
 * 6. Updating the current objective.
 * 7. Calculating lesson progress.
 * 8. Returning TutorLessonMemory.
 *
 * The database remains the source of truth.
 *
 * @param {Object} params
 * @param {Object} params.lessonProgress
 * @param {Array} params.objectives
 *
 * @returns {Promise<Object>}
 */
export async function determineNextTeachingState({
  lessonProgress,
  objectives,
}) {
  /*
   * ------------------------------------------------------------
   * VALIDATION
   * ------------------------------------------------------------
   */

  if (!lessonProgress?.id) {
    const error = new Error(
      "A valid lesson progress record is required."
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !Array.isArray(objectives) ||
    objectives.length === 0
  ) {
    const error = new Error(
      "No lesson objectives are available for this topic."
    );

    error.statusCode = 400;

    throw error;
  }

  /*
   * ------------------------------------------------------------
   * STEP 1
   * NORMALIZE OBJECTIVE ORDER
   * ------------------------------------------------------------
   *
   * TopicObjective.order determines the curriculum sequence.
   *
   * We sort locally even though File 3 should already provide
   * objectives in the correct order.
   *
   * This makes this service safe if objectives come from another
   * source later.
   */

  const orderedObjectives = [...objectives].sort(
    (a, b) => {
      const orderA =
        Number.isFinite(a.order)
          ? a.order
          : Number.MAX_SAFE_INTEGER;

      const orderB =
        Number.isFinite(b.order)
          ? b.order
          : Number.MAX_SAFE_INTEGER;

      return orderA - orderB;
    }
  );

  /*
   * ------------------------------------------------------------
   * STEP 2
   * REFRESH LESSON PROGRESS FROM DATABASE
   * ------------------------------------------------------------
   *
   * The lessonProgress object passed into this service may have
   * been loaded before another operation modified it.
   *
   * Therefore, the database is treated as the final source of
   * truth.
   *
   * Notice that we intentionally DO NOT fetch:
   *
   * student
   * tutorLearningProfile
   * tutorLearningInsight
   *
   * Those belong to the prompt preparation stage.
   *
   * File 6 only loads information required to determine lesson
   * progression.
   */

  const currentProgress =
    await db.tutorLessonProgress.findUnique({
      where: {
        id: lessonProgress.id,
      },

      include: {
        topic: true,

        objectiveProgress: {
          include: {
            objective: true,
          },

          orderBy: {
            objective: {
              order: "asc",
            },
          },
        },

        memory: true,
      },
    });

  if (!currentProgress) {
    const error = new Error(
      "Tutor lesson progress could not be found."
    );

    error.statusCode = 404;

    throw error;
  }

  /*
   * ------------------------------------------------------------
   * STEP 3
   * CREATE A QUICK OBJECTIVE PROGRESS LOOKUP
   * ------------------------------------------------------------
   *
   * Instead of repeatedly searching the objectiveProgress array,
   * create a Map.
   */

  const progressByObjectiveId =
    new Map(
      currentProgress.objectiveProgress.map(
        (progress) => [
          progress.objectiveId,
          progress,
        ]
      )
    );

  /*
   * ------------------------------------------------------------
   * STEP 4
   * DETERMINE COMPLETED OBJECTIVES
   * ------------------------------------------------------------
   *
   * We calculate completion from the actual objective progress
   * records rather than trusting progressPercent.
   */

  const completedObjectives =
    orderedObjectives.filter(
      (objective) => {
        const progress =
          progressByObjectiveId.get(
            objective.id
          );

        return (
          progress?.status ===
          "COMPLETED"
        );
      }
    );

  const completedCount =
    completedObjectives.length;

  const allObjectivesCompleted =
    completedCount ===
    orderedObjectives.length;

  /*
   * ------------------------------------------------------------
   * STEP 5
   * HANDLE COMPLETED LESSON
   * ------------------------------------------------------------
   */

  if (allObjectivesCompleted) {
    const completedAt =
      currentProgress.completedAt ||
      new Date();

    const completedProgress =
      await db.tutorLessonProgress.update({
        where: {
          id: currentProgress.id,
        },

        data: {
          status: "COMPLETED",

          progressPercent: 100,

          completedAt,

          lastAccessedAt:
            new Date(),
        },

        include: {
          topic: true,

          objectiveProgress: {
            include: {
              objective: true,
            },

            orderBy: {
              objective: {
                order: "asc",
              },
            },
          },

          memory: true,
        },
      });

    return {
      status: "COMPLETED",

      isComplete: true,

      isResume: true,

      isFirstObjective: false,

      objectiveChanged: false,

      objectiveIndex: -1,

      objectiveNumber: null,

      totalObjectives:
        orderedObjectives.length,

      objective: null,

      objectiveProgress: null,

      currentStep:
        currentProgress.currentStep ?? 0,

      progressPercent: 100,

      completedObjectives:
        completedCount,

      remainingObjectives: 0,

      lessonProgress:
        completedProgress,

      memory:
        completedProgress.memory ||
        null,

      reason:
        "All lesson objectives have been completed.",
    };
  }

  /*
   * ------------------------------------------------------------
   * STEP 6
   * RESOLVE CURRENT OBJECTIVE
   * ------------------------------------------------------------
   *
   * First respect currentObjectiveId if it points to a valid
   * incomplete objective.
   */

  let currentObjective = null;

  if (
    currentProgress.currentObjectiveId
  ) {
    currentObjective =
      orderedObjectives.find(
        (objective) =>
          objective.id ===
          currentProgress.currentObjectiveId
      ) || null;
  }

  /*
   * ------------------------------------------------------------
   * STEP 7
   * NEVER RESUME A COMPLETED OBJECTIVE
   * ------------------------------------------------------------
   *
   * The database may still contain an old currentObjectiveId
   * after an objective has been completed.
   *
   * If that happens, discard it and find the next incomplete
   * objective.
   */

  if (currentObjective) {
    const currentObjectiveProgress =
      progressByObjectiveId.get(
        currentObjective.id
      );

    if (
      currentObjectiveProgress?.status ===
      "COMPLETED"
    ) {
      currentObjective = null;
    }
  }

  /*
   * ------------------------------------------------------------
   * STEP 8
   * FIND FIRST INCOMPLETE OBJECTIVE
   * ------------------------------------------------------------
   */

  if (!currentObjective) {
    currentObjective =
      orderedObjectives.find(
        (objective) => {
          const progress =
            progressByObjectiveId.get(
              objective.id
            );

          return (
            progress?.status !==
            "COMPLETED"
          );
        }
      ) || null;
  }

  if (!currentObjective) {
    const error = new Error(
      "Unable to determine the next lesson objective."
    );

    error.statusCode = 500;

    throw error;
  }

  /*
   * ------------------------------------------------------------
   * STEP 9
   * GET OBJECTIVE PROGRESS
   * ------------------------------------------------------------
   */

  let objectiveProgress =
    progressByObjectiveId.get(
      currentObjective.id
    ) || null;

  /*
   * ------------------------------------------------------------
   * STEP 10
   * CREATE OBJECTIVE PROGRESS WHEN NECESSARY
   * ------------------------------------------------------------
   *
   * File 4 may create the first objective.
   *
   * When the student moves to Objective 2, Objective 3, etc.,
   * this service creates the progress record for that objective
   * the first time it becomes active.
   */

  if (!objectiveProgress) {
    objectiveProgress =
      await db.tutorObjectiveProgress.create({
        data: {
          lessonProgressId:
            currentProgress.id,

          objectiveId:
            currentObjective.id,

          status: "IN_PROGRESS",

          attempts: 0,

          correctAttempts: 0,

          masteryScore: 0,

          startedAt: new Date(),
        },

        include: {
          objective: true,
        },
      });
  } else if (
    objectiveProgress.status ===
    "NOT_STARTED"
  ) {
    /*
     * The objective already has a progress record but has not
     * actually been started yet.
     *
     * Do not reset any existing performance information.
     */

    objectiveProgress =
      await db.tutorObjectiveProgress.update({
        where: {
          id: objectiveProgress.id,
        },

        data: {
          status: "IN_PROGRESS",

          startedAt:
            objectiveProgress.startedAt ||
            new Date(),
        },

        include: {
          objective: true,
        },
      });
  }

  /*
   * ------------------------------------------------------------
   * STEP 11
   * DETERMINE CURRENT STEP
   * ------------------------------------------------------------
   *
   * currentStep belongs to TutorLessonProgress and represents
   * the student's position inside the current objective.
   */

  const storedStep =
    Number.isInteger(
      currentProgress.currentStep
    )
      ? currentProgress.currentStep
      : 0;

  /*
   * ------------------------------------------------------------
   * STEP 12
   * DETERMINE WHETHER THIS IS A NEW OBJECTIVE
   * ------------------------------------------------------------
   */

  const objectiveChanged =
    currentProgress.currentObjectiveId !==
    currentObjective.id;

  /*
   * ------------------------------------------------------------
   * STEP 13
   * DETERMINE WHETHER THIS IS A RESUME
   * ------------------------------------------------------------
   *
   * A student should be considered to be resuming if there is
   * evidence that the current objective was previously visited.
   *
   * We deliberately do NOT use startedAt alone here.
   *
   * Why?
   *
   * Because this service itself creates startedAt when an
   * objective first becomes active.
   *
   * Therefore, startedAt alone cannot reliably distinguish:
   *
   * "I am starting this objective for the first time"
   *
   * from:
   *
   * "I previously visited this objective."
   *
   * Instead, currentStep and attempts provide stronger evidence
   * that actual teaching or assessment already happened.
   */

  const isResume =
    !objectiveChanged &&
    (
      storedStep > 0 ||
      objectiveProgress.attempts > 0 ||
      objectiveProgress.correctAttempts > 0
    );

  /*
   * ------------------------------------------------------------
   * STEP 14
   * DETERMINE WHETHER THIS IS THE FIRST OBJECTIVE
   * ------------------------------------------------------------
   */

  const objectiveIndex =
    orderedObjectives.findIndex(
      (objective) =>
        objective.id ===
        currentObjective.id
    );

  const isFirstObjective =
    objectiveIndex === 0;

  /*
   * ------------------------------------------------------------
   * STEP 15
   * DETERMINE NEXT STEP
   * ------------------------------------------------------------
   *
   * If the student moved to a different objective, begin that
   * objective at step 0.
   *
   * If the student is returning to the same objective, preserve
   * the stored step.
   */

  const nextStep =
    objectiveChanged
      ? 0
      : storedStep;

  /*
   * ------------------------------------------------------------
   * STEP 16
   * CALCULATE OVERALL LESSON PROGRESS
   * ------------------------------------------------------------
   */

  const progressPercent =
    Math.round(
      (
        completedCount /
        orderedObjectives.length
      ) * 100
    );

  /*
   * ------------------------------------------------------------
   * STEP 17
   * SYNCHRONIZE LESSON PROGRESS
   * ------------------------------------------------------------
   */

  const now = new Date();

  const shouldUpdateProgress =
    objectiveChanged ||
    currentProgress.currentObjectiveId !==
      currentObjective.id ||
    currentProgress.currentStep !==
      nextStep ||
    currentProgress.progressPercent !==
      progressPercent ||
    currentProgress.status !==
      "IN_PROGRESS" ||
    !currentProgress.startedAt;

  let updatedProgress;

  if (shouldUpdateProgress) {
    updatedProgress =
      await db.tutorLessonProgress.update({
        where: {
          id: currentProgress.id,
        },

        data: {
          currentObjectiveId:
            currentObjective.id,

          currentStep: nextStep,

          progressPercent,

          status: "IN_PROGRESS",

          startedAt:
            currentProgress.startedAt ||
            now,

          lastAccessedAt: now,

          completedAt: null,
        },

        include: {
          topic: true,

          objectiveProgress: {
            include: {
              objective: true,
            },

            orderBy: {
              objective: {
                order: "asc",
              },
            },
          },

          memory: true,
        },
      });
  } else {
    /*
     * Nothing about the lesson position needs changing.
     *
     * We still update lastAccessedAt because the student has
     * returned to the lesson.
     */

    updatedProgress =
      await db.tutorLessonProgress.update({
        where: {
          id: currentProgress.id,
        },

        data: {
          lastAccessedAt: now,
        },

        include: {
          topic: true,

          objectiveProgress: {
            include: {
              objective: true,
            },

            orderBy: {
              objective: {
                order: "asc",
              },
            },
          },

          memory: true,
        },
      });
  }

  /*
   * ------------------------------------------------------------
   * STEP 18
   * RETURN TEACHING STATE
   * ------------------------------------------------------------
   */

  return {
    status: "IN_PROGRESS",

    isComplete: false,

    isResume,

    isFirstObjective,

    objectiveChanged,

    objectiveIndex,

    objectiveNumber:
      objectiveIndex + 1,

    totalObjectives:
      orderedObjectives.length,

    objective:
      currentObjective,

    objectiveProgress,

    currentStep: nextStep,

    progressPercent,

    completedObjectives:
      completedCount,

    remainingObjectives:
      orderedObjectives.length -
      completedCount,

    lessonProgress:
      updatedProgress,

    memory:
      updatedProgress.memory ||
      null,

    reason: objectiveChanged
      ? "Continuing with the next incomplete lesson objective."
      : isResume
        ? "Resuming the student's previous position in the current objective."
        : "Starting the current lesson objective.",
  };
}
