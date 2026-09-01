
import { db } from "../../../lib/db.js";

export async function createTutorLessonSession({
  studentId,
  lessonProgress,
}) {
  if (!studentId) {
    const error = new Error(
      "studentId is required."
    );

    error.statusCode = 400;
    throw error;
  }

  if (!lessonProgress) {
    const error = new Error(
      "A valid TutorLessonProgress record is required."
    );

    error.statusCode = 400;
    throw error;
  }

  if (lessonProgress.studentId !== studentId) {
    const error = new Error(
      "This lesson progress does not belong to the student."
    );

    error.statusCode = 403;
    throw error;
  }

  const now = new Date();

  const startingObjectiveId =
    lessonProgress.currentObjectiveId || null;

  const startingStep =
    typeof lessonProgress.currentStep === "number"
      ? lessonProgress.currentStep
      : 0;

  try {
    const { sessionId } = await db.$transaction(
      async (tx) => {
        const conversation =
          await tx.tutorConversation.create({
            data: {
              studentId,

              title:
                lessonProgress.topic?.title
                  ? `AI Tutor: ${lessonProgress.topic.title}`
                  : "AI Tutor Lesson",
            },
          });

        const session =
          await tx.tutorLessonSession.create({
            data: {
              studentId,
              lessonProgressId: lessonProgress.id,
              conversationId: conversation.id,
              startedAt: now,
              startingObjectiveId,
              startingStep,
            },
          });

        await tx.tutorLessonProgress.update({
          where: {
            id: lessonProgress.id,
          },

          data: {
            conversationId: conversation.id,
            lastAccessedAt: now,
          },
        });

        return {
          sessionId: session.id,
        };
      },
      {
        timeout: 10000,
      }
    );

    const session =
      await db.tutorLessonSession.findUnique({
        where: {
          id: sessionId,
        },

        include: {
          conversation: true,

          lessonProgress: {
            include: {
              topic: true,

              objectiveProgress: {
                include: {
                  objective: true,
                },
              },

              memory: true,
            },
          },

          events: true,
          messages: true,
        },
      });

    if (!session) {
      const error = new Error(
        "Unable to retrieve the created Tutor lesson session."
      );

      error.statusCode = 500;
      throw error;
    }

    return session;
  } catch (error) {
    console.error(
      `Failed to create Tutor lesson session for student ${studentId}:`,
      error
    );

    if (error?.statusCode) {
      throw error;
    }

    const databaseError = new Error(
      "Unable to create the Tutor lesson session."
    );

    databaseError.statusCode = 500;

    throw databaseError;
  }
}
