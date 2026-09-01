import { db } from "../../../lib/db.js";

import {
  buildCompletedLessonPrompt,
} from "./buildCompletedLessonPrompt.service.js";

import {
  streamTutorConversationResponse,
} from "./streamTutorConversationResponse.service.js";

import {
  getTutorStudentContext,
} from "./getTutorStudentContext.service.js";

export async function continueCompletedTutorLesson({
  req,
  res,
  student,
  topic,
  objectives,
  lessonProgress,
  teachingState,
  message,
  conversation,
  isNewConversation = false,
}) {
  try {
    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Handler entered"
    // );

    // console.log(
    //   "[LESSON TEACHING STATE]", teachingState
    // );

    // console.log("Student", student)

    if (!student.id) {
      const error = new Error(
        "A valid student is required."
      );

      error.statusCode = 400;

      throw error;
    }

    if (!topic?.id) {
      const error = new Error(
        "A valid lesson topic is required."
      );

      error.statusCode = 400;

      throw error;
    }

    if (!conversation?.id) {
      const error = new Error(
        "A valid Tutor conversation is required."
      );

      error.statusCode = 400;

      throw error;
    }

    // if (!teachingState?.isCompleted) {
    //   const error = new Error(
    //     "The lesson has not been completed."
    //   );

    //   error.statusCode = 400;

    //   throw error;
    // }

    const normalizedMessage =
      typeof message === "string"
        ? message.trim()
        : "";

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Student:",
    //   student.id
    // );

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Conversation:",
    //   conversation.id
    // );

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Topic:",
    //   topic.id,
    //   topic.title
    // );

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Confirmed lesson status:",
    //   teachingState.status
    // );

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Progress:",
    //   teachingState.progressPercent
    // );

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Incoming message:",
    //   normalizedMessage || "[NONE]"
    // );

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Loading Tutor student context..."
    // );

    const tutorStudentContext =
      await getTutorStudentContext(
        student.id
      );

    if (!tutorStudentContext?.student) {
      const error = new Error(
        "Unable to load Tutor student context."
      );

      error.statusCode = 500;

      throw error;
    }

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Tutor student context loaded."
    // );

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Building completed lesson prompt..."
    // );

    const completedLessonPrompt =
      await buildCompletedLessonPrompt({
        student:
          tutorStudentContext.student,

        topic,

        objectives,

        lessonProgress,

        teachingState,
      });

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Completed lesson prompt built."
    // );

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Refreshing conversation..."
    // );

    const refreshedConversation =
      await db.tutorConversation.findUnique({
        where: {
          id: conversation.id,
        },

        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
            },

            take: 50,
          },
        },
      });

    if (!refreshedConversation) {
      const error = new Error(
        "Tutor conversation could not be loaded."
      );

      error.statusCode = 404;

      throw error;
    }

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Conversation refreshed."
    // );

    const previousMessages =
      refreshedConversation.messages
        ?.slice(-20)
        ?.map((msg) => ({
          role:
            msg.role === "assistant"
              ? "model"
              : "user",

          parts: [
            {
              text: msg.content,
            },
          ],
        })) || [];

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Previous messages:",
    //   previousMessages.length
    // );

    const completedLessonEvent = {
      type: "lessonCompleted",

      lesson: {
        topicId: topic.id,

        topicTitle: topic.title,

        progressPercent:
          teachingState.progressPercent,

        completedObjectives:
          teachingState.completedObjectives,

        totalObjectives:
          teachingState.totalObjectives,

        status: "COMPLETED",
      },

      actions: {
        canContinueChat: true,
        canTakeTest: true,
        canTakeExam: true,
        canPlayGames: true,
      },
    };

    // console.log(
    //   "[CONTINUE COMPLETED LESSON] Starting unified Tutor conversation stream..."
    // );

    return await streamTutorConversationResponse({
      req,

      res,

      student,

      conversation:
        refreshedConversation,

      message:
        normalizedMessage,

      systemPrompt:
        completedLessonPrompt,

      previousMessages,

      isNewConversation,

      mode:
        "COMPLETED_LESSON",

      initialEvents: [
        completedLessonEvent,
      ],
    });
  } catch (error) {
    console.error(
      "[CONTINUE COMPLETED LESSON] ERROR:",
      error
    );

    if (!res.headersSent) {
      const statusCode =
        Number.isInteger(
          error?.statusCode
        )
          ? error.statusCode
          : 500;

      return res.status(
        statusCode
      ).json({
        success: false,

        message:
          error?.message ||
          "Unable to continue the completed Tutor lesson.",
      });
    }

    try {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message:
            "Tutor failed while continuing the completed lesson.",
        })}\n\n`
      );

      if (res.flush) {
        res.flush();
      }
    } catch {}

    try {
      res.end();
    } catch {}

    return;
  }
}


