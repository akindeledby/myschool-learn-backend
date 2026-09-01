
import { db } from "../../../lib/db.js";

/**
 * Finds or creates the persistent Tutor lesson progress
 * for a specific student and topic.
 *
 * TutorLessonProgress represents the student's overall position
 * in the topic and persists across multiple Tutor sessions.
 *
 * IMPORTANT:
 * An existing progress record is never reset by this function.
 *
 * @param {Object} params
 * @param {string} params.studentId
 * @param {string} params.topicId
 * @param {Array} params.objectives
 *
 * @returns {Promise<Object>} TutorLessonProgress record.
 */
export async function getOrCreateTutorLessonProgress({
  studentId,
  topicId,
  objectives,
}) {
  if (!studentId || !topicId) {
    const error = new Error(
      "studentId and topicId are required."
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !Array.isArray(objectives) ||
    objectives.length === 0
  ) {
    const error = new Error(
      "At least one lesson objective is required."
    );

    error.statusCode = 400;

    throw error;
  }

  /**
   * Check whether this student has already started this topic.
   *
   * Your schema guarantees that there can only be one record
   * for a student/topic combination:
   *
   * @@unique([studentId, topicId])
   */
  const existingProgress =
    await db.tutorLessonProgress.findUnique({
      where: {
        studentId_topicId: {
          studentId,
          topicId,
        },
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

        sessions: true,
        memory: true,
      },
    });

  /**
   * Existing progress means the student has previously
   * visited this topic.
   *
   * DO NOT reset:
   *
   * currentObjectiveId
   * currentStep
   * progressPercent
   * status
   * startedAt
   * completedAt
   *
   * The next teaching service will determine exactly where
   * the student should continue.
   */
  if (existingProgress) {
    return existingProgress;
  }

  /**
   * First visit to this topic.
   *
   * The first objective in the ordered objectives list
   * becomes the student's starting objective.
   */
  const firstObjective = objectives[0];

  if (!firstObjective?.id) {
    const error = new Error(
      "The first lesson objective is invalid."
    );

    error.statusCode = 500;

    throw error;
  }

  const now = new Date();

  try {
    /**
     * Create the overall lesson progress and its first
     * objective progress inside the same transaction.
     *
     * This ensures that we do not end up with a lesson progress
     * record without its corresponding first objective progress.
     */
    const progress = await db.$transaction(async (tx) => {
      const newProgress =
        await tx.tutorLessonProgress.create({
          data: {
            studentId,
            topicId,

            status: "IN_PROGRESS",

            currentObjectiveId: firstObjective.id,

            currentStep: 0,

            progressPercent: 0,

            startedAt: now,

            lastAccessedAt: now,
          },
        });

      /**
       * Create the student's progress record for the
       * first objective.
       *
       * Notice that we only use fields that actually exist
       * in your TutorObjectiveProgress model.
       */
      await tx.tutorObjectiveProgress.create({
        data: {
          lessonProgressId: newProgress.id,

          objectiveId: firstObjective.id,

          status: "IN_PROGRESS",

          attempts: 0,

          correctAttempts: 0,

          masteryScore: 0,

          startedAt: now,
        },
      });

      /**
       * Return the complete newly created progress object.
       */
      return tx.tutorLessonProgress.findUnique({
        where: {
          id: newProgress.id,
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

          sessions: true,
          memory: true,
        },
      });
    });

    return progress;
  } catch (error) {
    /**
     * Two requests could arrive at almost exactly the same time.
     *
     * Both could see that no progress exists and attempt to
     * create the first record.
     *
     * The database's:
     *
     * @@unique([studentId, topicId])
     *
     * constraint protects us from creating two progress records.
     *
     * If another request won the race, simply retrieve the
     * existing record and continue.
     */
    if (error?.code === "P2002") {
      const progress =
        await db.tutorLessonProgress.findUnique({
          where: {
            studentId_topicId: {
              studentId,
              topicId,
            },
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

            sessions: true,
            memory: true,
          },
        });

      if (progress) {
        return progress;
      }
    }

    console.error(
      `Failed to create TutorLessonProgress for student ${studentId} and topic ${topicId}:`,
      error
    );

    const databaseError = new Error(
      "Unable to create lesson progress."
    );

    databaseError.statusCode = 500;

    throw databaseError;
  }
}
