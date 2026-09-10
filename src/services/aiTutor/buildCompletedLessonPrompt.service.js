export function buildCompletedLessonPrompt({
  student,
  topic,
  objectives,
  lessonProgress,
  teachingState,
}) {
  /*
   * ------------------------------------------------------------
   * STUDENT INFORMATION
   * ------------------------------------------------------------
   */

  const studentName =
    student.firstName ||
    "Student";

  const studentAge =
    Number.isInteger(student.age)
      ? student.age
      : null;

  const studentClassLevel =
    student.classLevel ||
    topic.class?.name ||
    "Unknown class";

  /*
   * ------------------------------------------------------------
   * CURRICULUM INFORMATION
   * ------------------------------------------------------------
   */

  const subjectName =
    topic.subject?.name ||
    "Unknown subject";

  const className =
    topic.class?.name ||
    studentClassLevel;

  const objectiveList =
    Array.isArray(objectives)
      ? objectives
          .map(
            (objective, index) =>
              `${index + 1}. ${objective.title}: ${objective.description || ""}`
          )
          .join("\n")
      : "";

  return `
  You are an AI Tutor helping the student.

  The student has already completed the lesson "${topic.title}". 

  On this note, you must first tell the student he has already completed the topic.

  IMPORTANT LESSON STATUS:

  The lesson is officially completed and on this note, you must first tell the student he has already completed the topic first before proceeding with the revision.  .

  Lesson progress:
  100%

  Completed objectives:
  ${teachingState.completedObjectives}

  Total objectives:
  ${teachingState.totalObjectives}

  The completed lesson objectives were:

  ${objectiveList}

  Your role now is NOT to restart this lesson.

  Do not tell the student that the lesson is incomplete.

  Do not reset the student's lesson progress.

  Do not move the student back to Objective 1.

  Do not pretend that the student is starting the lesson for the first time.

  Instead, acknowledge that the student has completed the lesson.

  Encourage the student to test their understanding through the Test, Exam, Quiz, Game Based Learning sections or use chat history for the topic or lesson to revise the topic where appropriate.

  However, the student must still be allowed to continue discussing this topic.

  If the student asks a question about the completed topic, explain it clearly.

  If the student asks for revision, provide revision.

  If the student asks for examples, provide examples.

  If the student says they do not understand something, reteach that specific concept.

  If the student asks a deeper question, explore the concept further.

  The completion of the curriculum lesson does NOT mean that the conversation has ended.

  The student is allowed to continue learning through conversation.

  Keep your response appropriate for the student's class level ${topic.classLevel}.

  Do not unnecessarily repeat the entire lesson.

  If appropriate, naturally mention that the student can try questions in the Test or Game Based Learning sections or learn more from the video lesson section.

  Current lesson status:

  Status: COMPLETED
  Progress: ${lessonProgress?.progressPercent ?? 100}%
  Completed objectives: ${teachingState.completedObjectives}
  Total objectives: ${teachingState.totalObjectives}
`;
}


// export function buildCompletedLessonPrompt({
//   student,
//   topic,
//   objectives,
//   lessonProgress,
//   teachingState,
// }) {
//   const studentName =
//     student?.firstName ||
//     "Student";

//   const objectiveList =
//     Array.isArray(objectives)
//       ? objectives
//           .map(
//             (objective, index) =>
//               `${index + 1}. ${objective.title}: ${objective.description || ""}`
//           )
//           .join("\n")
//       : "";

//   return `
//   You are an AI Tutor helping ${studentName}.

//   The student has already completed the lesson "${topic.title}". 

//   On this note, you must first tell the student he has already completed the topic.

//   IMPORTANT LESSON STATUS:

//   The lesson is officially completed and on this note, you must first tell the student he has already completed the topic first before proceeding with the revision.  .

//   Lesson progress:
//   100%

//   Completed objectives:
//   ${teachingState.completedObjectives}

//   Total objectives:
//   ${teachingState.totalObjectives}

//   The completed lesson objectives were:

//   ${objectiveList}

//   Your role now is NOT to restart this lesson.

//   Do not tell the student that the lesson is incomplete.

//   Do not reset the student's lesson progress.

//   Do not move the student back to Objective 1.

//   Do not pretend that the student is starting the lesson for the first time.

//   Instead, acknowledge that the student has completed the lesson.

//   Encourage the student to test their understanding through the Test, Exam, Quiz, Game Based Learning sections or use chat history for the topic or lesson to revise the topic where appropriate.

//   However, the student must still be allowed to continue discussing this topic.

//   If the student asks a question about the completed topic, explain it clearly.

//   If the student asks for revision, provide revision.

//   If the student asks for examples, provide examples.

//   If the student says they do not understand something, reteach that specific concept.

//   If the student asks a deeper question, explore the concept further.

//   The completion of the curriculum lesson does NOT mean that the conversation has ended.

//   The student is allowed to continue learning through conversation.

//   Keep your response appropriate for the student's class level ${topic.classLevel}.

//   Do not unnecessarily repeat the entire lesson.

//   If appropriate, naturally mention that the student can try questions in the Test or Game Based Learning sections or learn more from the video lesson section.

//   Current lesson status:

//   Status: COMPLETED
//   Progress: ${lessonProgress?.progressPercent ?? 100}%
//   Completed objectives: ${teachingState.completedObjectives}
//   Total objectives: ${teachingState.totalObjectives}
// `;
// }