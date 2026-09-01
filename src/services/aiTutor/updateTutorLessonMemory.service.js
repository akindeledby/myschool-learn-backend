import { db } from "../../../lib/db.js";
/**
 * Updates the persistent memory for a student's current
 * curriculum lesson.
 *
 * TutorLessonMemory is lesson specific. It records what the
 * student understands, struggles with, misunderstands, and
 * still needs to learn within this particular lesson.
 *
 * This service does NOT replace the broader Tutor memory system:
 *
 * TutorSessionSummary
 * TutorTopicProgress
 * TutorLearningProfile
 * TutorLearningInsight
 *
 * Those systems continue to maintain long term student memory.
 *
 * TutorLessonMemory is specifically concerned with:
 *
 *     Student
 *        ↓
 *   Current Topic
 *        ↓
 *   Current Lesson
 *        ↓
 *   Current Understanding
 *
 * The service is intentionally independent from the streaming
 * service. It should be called after a meaningful interaction,
 * not once for every streamed token or sentence.
 *
 * @param {Object} params
 * @param {string} params.lessonProgressId
 * @param {string} params.interactionSummary
 * @param {string} [params.summary]
 * @param {Array|string} [params.strengths]
 * @param {Array|string} [params.weaknesses]
 * @param {Array|string} [params.misconceptions]
 * @param {Array|string} [params.masteredConcepts]
 * @param {Array|string} [params.pendingConcepts]
 *
 * @returns {Promise<Object>} Updated TutorLessonMemory
 */
export async function updateTutorLessonMemory({
  lessonProgressId,
  interactionSummary,
  summary,
  strengths,
  weaknesses,
  misconceptions,
  masteredConcepts,
  pendingConcepts,
}) {
  /*
   * ============================================================
   * VALIDATION
   * ============================================================
   */

  if (!lessonProgressId) {
    const error = new Error(
      "A valid lessonProgressId is required."
    );

    error.statusCode = 400;

    throw error;
  }

  /*
   * There is no reason to create or update lesson memory when
   * there was no meaningful interaction.
   *
   * This also prevents accidental empty memory records from
   * being generated.
   */
  const hasMeaningfulInteraction =
    typeof interactionSummary === "string" &&
    interactionSummary.trim().length > 0;

  if (!hasMeaningfulInteraction) {
    return db.tutorLessonMemory.findUnique({
      where: {
        lessonProgressId,
      },
    });
  }

  /*
   * ============================================================
   * VERIFY LESSON PROGRESS
   * ============================================================
   *
   * We verify that the lesson progress record actually exists
   * before creating memory.
   */

  const lessonProgress =
    await db.tutorLessonProgress.findUnique({
      where: {
        id: lessonProgressId,
      },

      select: {
        id: true,
        studentId: true,
        topicId: true,
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
   * ============================================================
   * NORMALIZE MEMORY VALUES
   * ============================================================
   *
   * Prisma Json fields can store arrays or objects.
   *
   * For lesson memory, arrays are preferable because the Tutor
   * can easily reason over individual strengths, weaknesses,
   * misconceptions, concepts, etc.
   *
   * We therefore normalize incoming values before persistence.
   */

  const normalizeArray = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === "string"
            ? item.trim()
            : item
        )
        .filter(Boolean);
    }

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return [value.trim()];
    }

    return null;
  };

  const normalizedStrengths =
    normalizeArray(strengths);

  const normalizedWeaknesses =
    normalizeArray(weaknesses);

  const normalizedMisconceptions =
    normalizeArray(misconceptions);

  const normalizedMasteredConcepts =
    normalizeArray(masteredConcepts);

  const normalizedPendingConcepts =
    normalizeArray(pendingConcepts);

  /*
   * ============================================================
   * GET EXISTING MEMORY
   * ============================================================
   */

  const existingMemory =
    await db.tutorLessonMemory.findUnique({
      where: {
        lessonProgressId,
      },
    });

  /*
   * ============================================================
   * MERGE MEMORY
   * ============================================================
   *
   * We do not blindly overwrite previously accumulated lesson
   * memory.
   *
   * For example, if the student previously demonstrated that
   * they understand "chlorophyll", we should not lose that
   * information simply because the latest interaction did not
   * mention it.
   */

  const mergeUniqueValues = (
    previous,
    incoming
  ) => {
    const previousValues =
      Array.isArray(previous)
        ? previous
        : [];

    const incomingValues =
      Array.isArray(incoming)
        ? incoming
        : [];

    const combined = [
      ...previousValues,
      ...incomingValues,
    ];

    const seen = new Set();

    return combined.filter((item) => {
      const key =
        typeof item === "string"
          ? item.trim().toLowerCase()
          : JSON.stringify(item);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
  };

  /*
   * ============================================================
   * MERGE EXISTING MEMORY
   * ============================================================
   */

  const mergedStrengths =
    mergeUniqueValues(
      existingMemory?.strengths,
      normalizedStrengths
    );

  const mergedWeaknesses =
    mergeUniqueValues(
      existingMemory?.weaknesses,
      normalizedWeaknesses
    );

  const mergedMisconceptions =
    mergeUniqueValues(
      existingMemory?.misconceptions,
      normalizedMisconceptions
    );

  const mergedMasteredConcepts =
    mergeUniqueValues(
      existingMemory?.masteredConcepts,
      normalizedMasteredConcepts
    );

  const mergedPendingConcepts =
    mergeUniqueValues(
      existingMemory?.pendingConcepts,
      normalizedPendingConcepts
    );

  /*
   * ============================================================
   * BUILD UPDATE DATA
   * ============================================================
   *
   * Only update fields that were actually supplied.
   *
   * This is important because a later interaction may only
   * provide a new misconception, for example. We do not want
   * undefined values to erase previous memory.
   */

  const data = {
    lastInteractionSummary:
      interactionSummary.trim(),
  };

  if (
    typeof summary === "string" &&
    summary.trim()
  ) {
    data.summary = summary.trim();
  }

  if (
    normalizedStrengths !== null
  ) {
    data.strengths =
      mergedStrengths;
  }

  if (
    normalizedWeaknesses !== null
  ) {
    data.weaknesses =
      mergedWeaknesses;
  }

  if (
    normalizedMisconceptions !== null
  ) {
    data.misconceptions =
      mergedMisconceptions;
  }

  if (
    normalizedMasteredConcepts !== null
  ) {
    data.masteredConcepts =
      mergedMasteredConcepts;
  }

  if (
    normalizedPendingConcepts !== null
  ) {
    data.pendingConcepts =
      mergedPendingConcepts;
  }

  /*
   * ============================================================
   * CREATE OR UPDATE MEMORY
   * ============================================================
   *
   * TutorLessonMemory has:
   *
   * @@unique([lessonProgressId])
   *
   * so lessonProgressId is the natural upsert key.
   */

  const memory =
    await db.tutorLessonMemory.upsert({
      where: {
        lessonProgressId,
      },

      create: {
        lessonProgressId,

        summary:
          typeof summary === "string" &&
          summary.trim()
            ? summary.trim()
            : null,

        strengths:
          normalizedStrengths !== null
            ? normalizedStrengths
            : undefined,

        weaknesses:
          normalizedWeaknesses !== null
            ? normalizedWeaknesses
            : undefined,

        misconceptions:
          normalizedMisconceptions !== null
            ? normalizedMisconceptions
            : undefined,

        masteredConcepts:
          normalizedMasteredConcepts !== null
            ? normalizedMasteredConcepts
            : undefined,

        pendingConcepts:
          normalizedPendingConcepts !== null
            ? normalizedPendingConcepts
            : undefined,

        lastInteractionSummary:
          interactionSummary.trim(),
      },

      update: data,
    });

  return memory;
}
