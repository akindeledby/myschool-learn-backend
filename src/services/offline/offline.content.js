import { db } from "../../../lib/db.js";

/**
 * Get all learning content authorized for a student
 * for offline use.
 *
 * The authorization hierarchy is:
 *
 * Student
 *   ↓
 * StudentSubject
 *   ↓
 * Subject
 *   ↓
 * Term
 *   ↓
 * Topic
 *   ↓
 * Quiz
 *   ↓
 * Question
 *
 * IMPORTANT:
 * - This service verifies CONTENT authorization only.
 * - It does NOT verify the user's identity/ownership.
 * - It does NOT verify subscription status.
 * - User/student authorization should be handled by
 *   offline.authorization.js.
 * - Subscription/offline entitlement should be handled
 *   by offline.sync.js.
 */
export async function getAuthorizedOfflineContent({
  studentId,
}) {
  if (!studentId) {
    return {
      success: false,
      statusCode: 400,
      message: "studentId is required.",
    };
  }

  try {
    /**
     * ---------------------------------------------------------
     * 1. Find the subjects assigned to the student.
     * ---------------------------------------------------------
     *
     * StudentSubject is the source of truth for the
     * student's authorized subjects.
     */
    const studentSubjects =
      await db.studentSubject.findMany({
        where: {
          studentId,
        },
        select: {
          subjectId: true,
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (studentSubjects.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message:
          "No subjects are assigned to this student.",
      };
    }

    const subjectIds = studentSubjects.map(
      ({ subjectId }) => subjectId
    );

    /**
     * ---------------------------------------------------------
     * 2. Fetch all terms belonging to the student's subjects.
     * ---------------------------------------------------------
     *
     * We explicitly verify that the term belongs to the
     * same subject. This prevents an inconsistent database
     * relationship from leaking into the offline package.
     */
    const terms = await db.term.findMany({
      where: {
        subjectId: {
          in: subjectIds,
        },
      },

      orderBy: [
        {
          subjectId: "asc",
        },
        {
          position: "asc",
        },
        {
          createdAt: "asc",
        },
      ],

      select: {
        id: true,
        name: true,
        position: true,
        classId: true,
        subjectId: true,
        schemeOfWorkId: true,
      },
    });

    /**
     * ---------------------------------------------------------
     * 3. Fetch all topics belonging to the student's subjects.
     * ---------------------------------------------------------
     *
     * Topics are additionally checked against their Term.
     */
    const topics = await db.topic.findMany({
      where: {
        subjectId: {
          in: subjectIds,
        },
      },

      orderBy: [
        {
          subjectId: "asc",
        },
        {
          termId: "asc",
        },
        {
          week: "asc",
        },
        {
          createdAt: "asc",
        },
      ],

      select: {
        id: true,
        week: true,
        title: true,
        status: true,
        currentStage: true,
        classId: true,
        subjectId: true,
        termId: true,

        subject: {
          select: {
            id: true,
            name: true,
          },
        },

        term: {
          select: {
            id: true,
            name: true,
            position: true,
            subjectId: true,
          },
        },

        quizzes: {
          orderBy: {
            createdAt: "asc",
          },

          select: {
            id: true,
            title: true,
            createdAt: true,

            questions: {
              orderBy: {
                createdAt: "asc",
              },

              select: {
                id: true,
                text: true,
                options: true,
                correctAnswer: true,
                explanation: true,
                quizId: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    /**
     * ---------------------------------------------------------
     * 4. Validate the learning hierarchy.
     * ---------------------------------------------------------
     *
     * Every Topic must:
     *
     * Topic.subjectId === Term.subjectId
     *
     * Every Term must belong to one of the student's
     * authorized subjects.
     */
    const authorizedSubjectIdSet =
      new Set(subjectIds);

    const invalidTerm = terms.some(
      (term) =>
        !authorizedSubjectIdSet.has(
          term.subjectId
        )
    );

    if (invalidTerm) {
      console.error(
        "OFFLINE CONTENT TERM AUTHORIZATION ERROR:",
        {
          studentId,
          terms,
        }
      );

      return {
        success: false,
        statusCode: 500,
        message:
          "Learning content hierarchy is inconsistent.",
      };
    }

    const termMap = new Map(
      terms.map((term) => [
        term.id,
        term,
      ])
    );

    const invalidTopic = topics.some(
      (topic) => {
        const term =
          termMap.get(topic.termId);

        if (!term) {
          return true;
        }

        return (
          topic.subjectId !==
            term.subjectId ||
          topic.term.subjectId !==
            topic.subjectId
        );
      }
    );

    if (invalidTopic) {
      console.error(
        "OFFLINE CONTENT HIERARCHY ERROR:",
        {
          studentId,
          topics,
        }
      );

      return {
        success: false,
        statusCode: 500,
        message:
          "Learning content hierarchy is inconsistent.",
      };
    }

    /**
     * ---------------------------------------------------------
     * 5. Build a clean subject collection.
     * ---------------------------------------------------------
     *
     * We already obtained the subjects through
     * StudentSubject, so we don't need another database query.
     */
    const subjects = studentSubjects.map(
      ({ subject }) => subject
    );

    /**
     * ---------------------------------------------------------
     * 6. Return the complete offline learning package.
     * ---------------------------------------------------------
     *
     * Subscription entitlement is intentionally NOT returned
     * here. That belongs to offline.sync.js.
     */
    return {
      success: true,

      content: {
        subjects,
        terms,
        topics,
      },

      subjectIds,
    };
  } catch (error) {
    console.error(
      "Get Authorized Offline Content Error:",
      error
    );

    return {
      success: false,
      statusCode: 500,
      message:
        "Unable to retrieve authorized offline learning content.",
    };
  }
}