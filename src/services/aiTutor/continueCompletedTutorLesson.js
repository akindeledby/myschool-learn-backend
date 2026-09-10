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

/*
============================================================
VALIDATION
============================================================
*/

if (!student?.id) {
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

const normalizedMessage =
  typeof message === "string"
    ? message.trim()
    : "";

if (!normalizedMessage) {
  const error = new Error(
    "Message is required."
  );

  error.statusCode = 400;

  throw error;
}

/*
============================================================
REFRESH CONVERSATION
============================================================
*
* The user message has already been saved by
* handleCompletedTutorLesson.
*
* Reload the conversation so the unified streaming service
* receives the latest conversation state.
*/


const refreshedConversation =
  await db.tutorConversation.findUnique({
    where: {
      id:
        conversation.id,
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

/*
============================================================
PREVIOUS MESSAGES
============================================================
*
* The current user message is supplied separately to the
* unified streaming service.
*
* Therefore it must not be included in previousMessages.
*/


const previousMessages =
  refreshedConversation.messages
    ?.slice(0, -1)
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


/*
============================================================
LOAD TUTOR STUDENT CONTEXT
============================================================
*/

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

/*
============================================================
BUILD COMPLETED LESSON PROMPT
============================================================
*/

const completedLessonPrompt =
  await buildCompletedLessonPrompt({
    student:
      tutorStudentContext.student,

    topic,

    objectives,

    lessonProgress,

    teachingState:
      teachingState || {
        isComplete:
          true,

        status:
          "COMPLETED",

        progressPercent:
          100,

        completedObjectives:
          Array.isArray(
            objectives
          )
            ? objectives.length
            : 0,

        totalObjectives:
          Array.isArray(
            objectives
          )
            ? objectives.length
            : 0,
      },
  });

// console.log(
//   "[CONTINUE COMPLETED LESSON] Completed lesson prompt built."
// );

/*
============================================================
COMPLETED LESSON EVENT DATA
============================================================
*
* The unified streaming service owns the SSE connection.
*
* We therefore pass the completed lesson event data to it.
*
* The streaming service should send this event before the
* AI response begins.
*/

const completedLessonEvent = {
  type:
    "lessonCompleted",

  lesson: {
    topicId:
      topic.id,

    topicTitle:
      topic.title,

    progressPercent:
      teachingState?.progressPercent ??
      100,

    completedObjectives:
      teachingState?.completedObjectives ??
      (
        Array.isArray(
          objectives
        )
          ? objectives.length
          : 0
      ),

    totalObjectives:
      teachingState?.totalObjectives ??
      (
        Array.isArray(
          objectives
        )
          ? objectives.length
          : 0
      ),

    status:
      "COMPLETED",
  },

  actions: {
    canContinueChat:
      true,

    canTakeTest:
      true,

    canTakeExam:
      true,

    canPlayGames:
      true,
  },
};

/*
============================================================
UNIFIED STREAM
============================================================
*
* This is now the ONLY place where the actual Tutor response
* is streamed.
*
* The completed lesson flow uses exactly the same streaming
* engine as normal chat.
*/

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
      type:
        "error",

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
