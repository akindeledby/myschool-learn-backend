import { ensureTopicObjectives } from "./tutorObjectives.service.js";
import { getOrCreateTutorLessonProgress } from "./getOrCreateTutorLessonProgress.service.js";
import { createTutorLessonSession } from "./createTutorLessonSession.service.js";
import { determineNextTeachingState } from "./determineNextTeachingState.service.js";
import { getTutorStudentContext } from "./getTutorStudentContext.service.js";
import { buildLessonTeachingPrompt } from "./buildLessonTeachingPrompt.service.js";
import { streamTutorLesson } from "./streamTutorLesson.service.js";

/**
 * Starts a curriculum lesson from a topic resolved from
 * the student's Tutor message.
 *
 * Used for:
 *
 *    PREVIOUS_TOPIC
 *    NEW_TOPIC
 *
 * The controller has already:
 *
 *    1. resolved the student
 *    2. resolved the topic
 *    3. created/resolved the conversation
 *    4. saved the user message
 *
 * This service therefore owns only the lesson lifecycle.
 */
export async function startTutorLessonFromContext({
  req,
  res,
  student,
  topic,
  message,
  conversation,
  userMessage,
  isNewConversation = false,
}) {
  /*
  ============================================================
  VALIDATE INPUT
  ============================================================
  */

  const conversationId =
    conversation.id;

  if (!student?.id) {
    const error = new Error(
      "A valid student is required to start the Tutor lesson."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!topic?.id) {
    const error = new Error(
      "A valid curriculum topic is required."
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
  ENSURE TOPIC OBJECTIVES
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
  GET OR CREATE PERSISTENT LESSON PROGRESS
  ============================================================
  */

  const lessonProgress =
    await getOrCreateTutorLessonProgress({
      studentId:
        student.id,

      topicId:
        topic.id,
    });

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
  HANDLE COMPLETED LESSON
  ============================================================
  *
  * Do this BEFORE creating a new lesson session.
  *
  ============================================================
  */

  if (teachingState.isComplete) {
    return res.status(200).json({
      success:
        true,

      status:
        "COMPLETED",

      message:
        "This lesson has already been completed.",

      lesson: {
        topicId:
          topic.id,

        topicTitle:
          topic.title,

        progressPercent:
          teachingState.progressPercent,

        completedObjectives:
          teachingState.completedObjectives,

        totalObjectives:
          teachingState.totalObjectives,
      },

      lessonProgress: {
        id:
          teachingState
            .lessonProgress
            .id,

        status:
          teachingState
            .lessonProgress
            .status,

        progressPercent:
          teachingState
            .lessonProgress
            .progressPercent,
      },
    });
  }

  /*
  ============================================================
  CREATE NEW LESSON SESSION
  ============================================================
  */

  const session =
    await createTutorLessonSession({
      studentId:
        student.id,

      lessonProgressId:
        teachingState
          .lessonProgress
          .id,

      conversationId,
    });

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
  BUILD CURRICULUM PROMPT
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
  */

  return await streamTutorLesson({
    req,
    res,

    studentId:
      student.id,

    topic,

    session,

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
}


// import { ensureTopicObjectives } from "./tutorObjectives.service.js";
// import { getOrCreateTutorLessonProgress } from "./getOrCreateTutorLessonProgress.service.js";
// import { createTutorLessonSession } from "./createTutorLessonSession.service.js";
// import { determineNextTeachingState } from "./determineNextTeachingState.service.js";
// import { getTutorStudentContext } from "./getTutorStudentContext.service.js";
// import { buildLessonTeachingPrompt } from "./buildLessonTeachingPrompt.service.js";
// import { streamTutorLesson } from "./streamTutorLesson.service.js";

// /**
//  * Starts a curriculum lesson from a topic resolved from
//  * the student's free Tutor message.
//  *
//  * This service is used when
//  * resolveTutorConversationContext() returns:
//  *
//  *    PREVIOUS_TOPIC
//  *    NEW_TOPIC
//  *
//  * Unlike startTutorLesson(), the frontend did not explicitly
//  * select subjectId, termId and topicId.
//  *
//  * The topic has already been safely resolved by the context
//  * resolver.
//  *
//  * This service therefore does not perform topic selection.
//  * It receives the already resolved topic and starts the
//  * appropriate lesson pipeline.
//  *
//  * @param {Object} params
//  * @param {Object} params.req
//  * @param {Object} params.res
//  * @param {Object} params.student
//  * @param {Object} params.topic
//  * @param {string} params.message
//  *
//  * @returns {Promise<void>}
//  */
// export async function startTutorLessonFromContext({
//   req,
//   res,
//   student,
//   topic,
//   message,
// }) {
//   /*
//    * ============================================================
//    * VALIDATE INPUT
//    * ============================================================
//    */

//   if (!student?.id) {
//     const error = new Error(
//       "A valid student is required to start the Tutor lesson."
//     );

//     error.statusCode = 400;

//     throw error;
//   }

//   if (!topic?.id) {
//     const error = new Error(
//       "A valid curriculum topic is required."
//     );

//     error.statusCode = 400;

//     throw error;
//   }

//   /*
//    * ============================================================
//    * ENSURE TOPIC OBJECTIVES
//    * ============================================================
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
//    * GET OR CREATE PERSISTENT LESSON PROGRESS
//    * ============================================================
//    *
//    * TutorLessonProgress is long-lived.
//    *
//    * If the student studied this topic before,
//    * their existing progress is reused.
//    *
//    * If this is the first time,
//    * a new progress record is created.
//    */

//   const lessonProgress =
//     await getOrCreateTutorLessonProgress({
//       studentId:
//         student.id,

//       topicId:
//         topic.id,
//     });

//   /*
//    * ============================================================
//    * CREATE NEW LESSON SESSION
//    * ============================================================
//    *
//    * Every new visit to the lesson receives a new session.
//    */

//   const session =
//     await createTutorLessonSession({
//       studentId:
//         student.id,

//       lessonProgressId:
//         lessonProgress.id,
//     });

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
//    * HANDLE COMPLETED LESSON
//    * ============================================================
//    */

//   if (teachingState.isComplete) {
//     return res.status(200).json({
//       success: true,

//       status: "COMPLETED",

//       message:
//         "This lesson has already been completed.",

//       lesson: {
//         topicId:
//           topic.id,

//         topicTitle:
//           topic.title,

//         progressPercent:
//           teachingState.progressPercent,

//         completedObjectives:
//           teachingState.completedObjectives,

//         totalObjectives:
//           teachingState.totalObjectives,
//       },

//       lessonProgress: {
//         id:
//           teachingState.lessonProgress.id,

//         status:
//           teachingState.lessonProgress.status,

//         progressPercent:
//           teachingState.lessonProgress.progressPercent,
//       },
//     });
//   }

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
//    * BUILD CURRICULUM PROMPT
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
//    * START LESSON STREAM
//    * ============================================================
//    */

//   return await streamTutorLesson({
//     req,
//     res,

//     studentId:
//       student.id,

//     topic,

//     session,

//     lessonProgress:
//       teachingState.lessonProgress,

//     teachingState,

//     prompt,

//     message,
//   });
// }