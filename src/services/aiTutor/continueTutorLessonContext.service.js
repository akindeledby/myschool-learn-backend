import { db } from "../../../lib/db.js";
import { getTutorStudentContext } from "./getTutorStudentContext.service.js";
import { buildLessonTeachingPrompt } from "./buildLessonTeachingPrompt.service.js";
import { determineNextTeachingState } from "./determineNextTeachingState.service.js";
import { ensureTopicObjectives } from "./tutorObjectives.service.js";
import { completeTutorObjective } from "./completeTutorObjective.service.js";
import { streamTutorLesson } from "./streamTutorLesson.service.js";


/**
 * Continues an already active Tutor lesson.
 *
 * This service owns the complete CURRENT_LESSON lifecycle.
 *
 * It:
 *
 * 1. Validates the lesson context.
 * 2. Ensures objectives exist.
 * 3. Determines the current teaching state.
 * 4. Loads the student's Tutor context.
 * 5. Builds the lesson prompt.
 * 6. Streams and saves the assistant response.
 * 7. Completes the current objective.
 * 8. Updates the lesson session ending state.
 * 9. Sends the final lesson done event.
 */
export async function continueTutorLessonContext({
  req,
  res,
  student,
  topic,
  lessonProgress,
  lessonSession,
  message,
  conversation,
  userMessage,
  isNewConversation = false,
}) {
  /*
  ============================================================
  VALIDATE LESSON CONTEXT
  ============================================================
  */
 const conversationId =
  conversation.id;

  if (!student?.id) {
    const error = new Error(
      "A valid student is required to continue the Tutor lesson."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!topic?.id) {
    const error = new Error(
      "A valid topic is required to continue the Tutor lesson."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!lessonProgress?.id) {
    const error = new Error(
      "A valid lesson progress record is required."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!lessonSession?.id) {
    const error = new Error(
      "A valid lesson session is required."
    );

    error.statusCode = 400;

    throw error;
  }

  // if (!conversation?.id) {
  //   const error = new Error(
  //     "A valid Tutor conversation is required."
  //   );

  //   error.statusCode = 400;

  //   throw error;
  // }

  /*
  ============================================================
  VERIFY SESSION IS STILL ACTIVE
  ============================================================
  */

  if (lessonSession.endedAt) {
    const error = new Error(
      "This Tutor lesson session has already ended. Please start or resume the lesson."
    );

    error.statusCode = 409;

    throw error;
  }

  /*
  ============================================================
  ENSURE OBJECTIVES
  ============================================================
  */

  const objectives =
    await ensureTopicObjectives(
      topic
    );

  if (
    !Array.isArray(objectives) ||
    objectives.length === 0
  ) {
    const error = new Error(
      "No lesson objectives are available for this topic."
    );

    error.statusCode = 500;

    throw error;
  }

  /*
  ============================================================
  DETERMINE TEACHING STATE
  ============================================================
  */

  const teachingState =
    await determineNextTeachingState({
      lessonProgress,

      objectives,
    });

  /*
  ============================================================
  CHECK LESSON COMPLETION
  ============================================================
  */

  if (
    teachingState.isComplete
  ) {
    return res.status(409).json({
      success: false,

      status:
        "COMPLETED",

      message:
        "This Tutor lesson has already been completed.",
    });
  }

  /*
  ============================================================
  LOAD STUDENT TUTOR CONTEXT
  ============================================================
  */

  const tutorStudentContext =
    await getTutorStudentContext(
      student.id
    );

  /*
  ============================================================
  BUILD LESSON PROMPT
  ============================================================
  */

  const prompt =
    await buildLessonTeachingPrompt({
      student:
        tutorStudentContext.student,

      topic,

      objectives,

      lessonProgress:
        teachingState.lessonProgress,

      teachingState,

      learningProfile:
        tutorStudentContext.learningProfile,

      learningInsight:
        tutorStudentContext.learningInsight,
    });

  /*
  ============================================================
  START LESSON STREAM
  ============================================================
  *
  * streamTutorLesson() must:
  *
  *   1. Stream the AI response.
  *   2. Generate TTS.
  *   3. Generate optional image.
  *   4. Save the assistant TutorMessage exactly once.
  *
  * It must NOT complete the objective.
  *
  ============================================================
  */

  const streamResult =
    await streamTutorLesson({
      req,
      res,

      studentId:
        student.id,

      topic,

      session:
        lessonSession,

      lessonProgress:
        teachingState.lessonProgress,

      teachingState,

      prompt,

      message,

      conversation,

      conversationId,

      userMessage,

      isNewConversation,
    });

  /*
  ============================================================
  ASSISTANT RESPONSE MUST HAVE BEEN SAVED
  ============================================================
  *
  * streamTutorLesson() should return after the AI response
  * has been completely generated and the assistant message
  * has been persisted.
  *
  * Do not save the assistant message again here.
  *
  ============================================================
  */

  /*
  ============================================================
  DETERMINE CURRENT OBJECTIVE
  ============================================================
  */

  const currentObjectiveId =
    teachingState?.objective?.id ||
    teachingState?.lessonProgress
      ?.currentObjectiveId ||
    lessonProgress?.currentObjectiveId;

  if (!currentObjectiveId) {
    const error = new Error(
      "Unable to determine the current Tutor lesson objective."
    );

    error.statusCode = 500;

    throw error;
  }

  /*
  ============================================================
  COMPLETE CURRENT OBJECTIVE
  ============================================================
  *
  * THIS IS LESSON ONLY.
  *
  * GENERAL CONVERSATIONS NEVER REACH THIS CODE.
  *
  ============================================================
  */

  const objectiveCompletion =
    await completeTutorObjective({
      lessonProgressId:
        teachingState
          ?.lessonProgress
          ?.id ||
        lessonProgress.id,

      objectiveId:
        currentObjectiveId,
    });

  /*
  ============================================================
  UPDATE LESSON SESSION ENDING STATE
  ============================================================
  */

  await db.tutorLessonSession.update({
    where: {
      id:
        lessonSession.id,
    },

    data: {
      endingObjectiveId:
        objectiveCompletion
          ?.lessonProgress
          ?.currentObjectiveId ??
        null,

      endingStep:
        objectiveCompletion
          ?.lessonProgress
          ?.currentStep ??
        null,
    },
  });

  /*
  ============================================================
  SEND LESSON COMPLETE EVENT
  ============================================================
  */

  if (!res.writableEnded) {
    res.write(
      `data: ${JSON.stringify({
        type:
          "done",

        lessonProgress: {
          id:
            objectiveCompletion
              ?.lessonProgress
              ?.id,

          currentObjectiveId:
            objectiveCompletion
              ?.lessonProgress
              ?.currentObjectiveId,

          currentStep:
            objectiveCompletion
              ?.lessonProgress
              ?.currentStep,

          progressPercent:
            objectiveCompletion
              ?.lessonProgress
              ?.progressPercent,

          status:
            objectiveCompletion
              ?.lessonProgress
              ?.status,
        },

        objective: {
          completed:
            true,

          completedObjectiveId:
            currentObjectiveId,

          nextObjectiveId:
            objectiveCompletion
              ?.nextObjective
              ?.id ??
            null,
        },
      })}\n\n`
    );

    if (res.flush) {
      res.flush();
    }

    res.end();
  }

  /*
  ============================================================
  BACKGROUND LESSON WORK
  ============================================================
  */

  const backgroundTasks = [
    {
      name:
        "TutorMemory",

      task:
        updateTutorMemory({
          conversationId,

          studentId:
            student.id,
        }),
    },

    {
      name:
        "ConversationSummary",

      task:
        generateConversationSummary(
          conversationId,
          student.id
        ),
    },

    {
      name:
        "LearningInsights",

      task:
        generateLearningInsights(
          student.id
        ),
    },

    {
      name:
        "LearningProfile",

      task:
        updateLearningProfile(
          conversationId,
          student.id
        ),
    },

    {
      name:
        "Achievements",

      task:
        checkAchievements(
          student.id
        ),
    },

    {
      name:
        "TopicProgress",

      task:
        updateTopicProgress({
          conversationId,

          studentId:
            student.id,

          topicId:
            topic.id,

          lessonProgressId:
            objectiveCompletion
              ?.lessonProgress
              ?.id ||
            lessonProgress.id,

          lessonSessionId:
            lessonSession.id,
        }),
    },
  ];

  Promise.allSettled(
    backgroundTasks.map(
      async ({
        name,
        task,
      }) => {
        try {
          console.log(
            `[TutorLesson] Background task STARTED: ${name}`
          );

          await task;

          console.log(
            `[TutorLesson] Background task COMPLETED: ${name}`
          );
        } catch (error) {
          console.error(
            `[TutorLesson] Background task FAILED: ${name}`,
            error
          );
        }
      }
    )
  );

  return;
}


// import { getTutorStudentContext } from "./getTutorStudentContext.service.js";
// import { buildLessonTeachingPrompt } from "./buildLessonTeachingPrompt.service.js";
// import { determineNextTeachingState } from "./determineNextTeachingState.service.js";
// import { ensureTopicObjectives } from "./tutorObjectives.service.js";
// import { streamTutorLesson } from "./streamTutorLesson.service.js";

// /**
//  * Continues an already active Tutor lesson.
//  *
//  * This service is used when resolveTutorConversationContext()
//  * returns:
//  *
//  *    CURRENT_LESSON
//  *
//  * The lesson session already exists.
//  * The lesson progress already exists.
//  * The topic is already known.
//  *
//  * Therefore this service does not create a new session.
//  *
//  * It only:
//  *
//  *    1. Verifies the session is active.
//  *    2. Ensures the topic objectives are available.
//  *    3. Determines the current teaching state.
//  *    4. Loads the student's Tutor context.
//  *    5. Builds the lesson prompt.
//  *    6. Continues the existing streaming pipeline.
//  *
//  * @param {Object} params
//  * @param {Object} params.req
//  * @param {Object} params.res
//  * @param {Object} params.student
//  * @param {Object} params.topic
//  * @param {Object} params.lessonProgress
//  * @param {Object} params.lessonSession
//  * @param {string} params.message
//  *
//  * @returns {Promise<void>}
//  */
// export async function continueTutorLesson({
//   req,
//   res,
//   student,
//   topic,
//   lessonProgress,
//   lessonSession,
//   message,
// }) {
//   /*
//    * ============================================================
//    * VALIDATE LESSON CONTEXT
//    * ============================================================
//    */

//   if (!student?.id) {
//     const error = new Error(
//       "A valid student is required to continue the Tutor lesson."
//     );

//     error.statusCode = 400;

//     throw error;
//   }

//   if (!topic?.id) {
//     const error = new Error(
//       "A valid topic is required to continue the Tutor lesson."
//     );

//     error.statusCode = 400;

//     throw error;
//   }

//   if (!lessonProgress?.id) {
//     const error = new Error(
//       "A valid lesson progress record is required."
//     );

//     error.statusCode = 400;

//     throw error;
//   }

//   if (!lessonSession?.id) {
//     const error = new Error(
//       "A valid lesson session is required."
//     );

//     error.statusCode = 400;

//     throw error;
//   }

//   /*
//    * ============================================================
//    * VERIFY SESSION IS STILL ACTIVE
//    * ============================================================
//    */

//   if (lessonSession.endedAt) {
//     const error = new Error(
//       "This Tutor lesson session has already ended. Please start or resume the lesson."
//     );

//     error.statusCode = 409;

//     throw error;
//   }

//   /*
//    * ============================================================
//    * ENSURE OBJECTIVES
//    * ============================================================
//    *
//    * The controller does not need to know how objectives
//    * are generated or retrieved.
//    *
//    * This remains part of the lesson pipeline.
//    */

//   const objectives =
//     await ensureTopicObjectives(topic);

//   if (
//     !Array.isArray(objectives) ||
//     objectives.length === 0
//   ) {
//     const error = new Error(
//       "No lesson objectives are available for this topic."
//     );

//     error.statusCode = 500;

//     throw error;
//   }

//   /*
//    * ============================================================
//    * DETERMINE TEACHING STATE
//    * ============================================================
//    */

//   const teachingState =
//     await determineNextTeachingState({
//       lessonProgress,
//       objectives,
//     });

//   /*
//    * ============================================================
//    * LOAD STUDENT TUTOR CONTEXT
//    * ============================================================
//    */

//   const tutorStudentContext =
//     await getTutorStudentContext(
//       student.id
//     );

//   /*
//    * ============================================================
//    * BUILD LESSON PROMPT
//    * ============================================================
//    */

//   const prompt =
//     await buildLessonTeachingPrompt({
//       student:
//         tutorStudentContext.student,

//       topic,

//       objectives,

//       lessonProgress:
//         teachingState.lessonProgress,

//       teachingState,

//       learningProfile:
//         tutorStudentContext.learningProfile,

//       learningInsight:
//         tutorStudentContext.learningInsight,
//     });

//   /*
//    * ============================================================
//    * CONTINUE EXISTING LESSON
//    * ============================================================
//    */

//   return await streamTutorLesson({
//     req,
//     res,

//     studentId:
//       student.id,

//     topic,

//     session:
//       lessonSession,

//     lessonProgress:
//       teachingState.lessonProgress,

//     teachingState,

//     prompt,

//     message,
//   });
// }