import { updateTutorLessonProgress } from "./updateTutorLessonProgress.service.js";

export async function completeTutorObjective({
  lessonProgressId,
  objectiveId,
}) {
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

  return await updateTutorLessonProgress({
    lessonProgressId,
    objectiveId,

    isCorrect: false,

    completeObjective: true,

    recordAttempt: false,
  });
}


// import { updateTutorLessonProgress } from "./updateTutorLessonProgress.service.js";

// /**
//  * Completes the student's current Tutor lesson objective
//  * after the Tutor has finished teaching it.
//  *
//  * This operation is independent of whether the student answered
//  * a question correctly.
//  *
//  * The objective is considered completed because the teaching
//  * interaction for that objective has been delivered.
//  *
//  * It delegates the actual persistence and lesson advancement
//  * logic to updateTutorLessonProgress().
//  *
//  * @param {Object} params
//  * @param {string} params.lessonProgressId
//  * @param {string} params.objectiveId
//  *
//  * @returns {Promise<Object>} Updated lesson and objective progress.
//  */
// export async function completeTutorObjective({
//   lessonProgressId,
//   objectiveId,
// }) {
//   if (!lessonProgressId) {
//     const error = new Error(
//       "A valid lesson progress ID is required."
//     );

//     error.statusCode = 400;

//     throw error;
//   }

//   if (!objectiveId) {
//     const error = new Error(
//       "A valid objective ID is required."
//     );

//     error.statusCode = 400;

//     throw error;
//   }

//   return await updateTutorLessonProgress({
//     lessonProgressId,
//     objectiveId,

//     /*
//      * This is deliberately not treated as a student attempt.
//      * The objective is being completed because the Tutor has
//      * finished teaching it.
//      */
//     isCorrect: false,

//     completeObjective: true,

//     recordAttempt: false,
//   });
// }