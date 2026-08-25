import { GoogleGenerativeAI } from "@google/generative-ai";

import { db } from "../../../lib/db.js";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

// ============================================================
// RESPONSE SCHEMA
// ============================================================

const quizResponseSchema = {
  type: "object",

  properties: {
    title: {
      type: "string",
    },

    questions: {
      type: "array",

      items: {
        type: "object",

        properties: {
          text: {
            type: "string",
          },

          options: {
            type: "array",

            items: {
              type: "string",
            },

            minItems: 4,
            maxItems: 4,
          },

          correctAnswerIndex: {
            type: "integer",

            minimum: 0,
            maximum: 3,
          },

          explanation: {
            type: "string",
          },
        },

        required: [
          "text",
          "options",
          "correctAnswerIndex",
          "explanation",
        ],
      },
    },
  },

  required: [
    "title",
    "questions",
  ],
};

// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

// ============================================================
// VALIDATE QUESTION
// ============================================================

function validateQuestion(question, index) {
  if (
    !question ||
    typeof question !== "object"
  ) {
    throw new Error(
      `Invalid question at index ${index}.`
    );
  }

  // ==========================================================
  // QUESTION TEXT
  // ==========================================================

  const questionText =
    normalizeText(question.text);

  if (!questionText) {
    throw new Error(
      `Question ${index + 1} has no question text.`
    );
  }

  // ==========================================================
  // OPTIONS
  // ==========================================================

  if (!Array.isArray(question.options)) {
    throw new Error(
      `Question ${index + 1} has invalid options.`
    );
  }

  if (question.options.length !== 4) {
    throw new Error(
      `Question ${index + 1} must contain exactly four options.`
    );
  }

  const options =
    question.options.map(normalizeText);

  // ==========================================================
  // EMPTY OPTIONS
  // ==========================================================

  if (
    options.some(
      (option) => !option
    )
  ) {
    throw new Error(
      `Question ${index + 1} contains an empty option.`
    );
  }

  // ==========================================================
  // DUPLICATE OPTIONS
  // ==========================================================

  const uniqueOptions =
    new Set(
      options.map((option) =>
        option.toLowerCase()
      )
    );

  if (uniqueOptions.size !== 4) {
    throw new Error(
      `Question ${index + 1} contains duplicate options.`
    );
  }

  // ==========================================================
  // CORRECT ANSWER INDEX
  // ==========================================================

  const correctAnswerIndex =
    Number(question.correctAnswerIndex);

  if (
    !Number.isInteger(
      correctAnswerIndex
    ) ||
    correctAnswerIndex < 0 ||
    correctAnswerIndex > 3
  ) {
    throw new Error(
      `Question ${index + 1} has an invalid correctAnswerIndex: ${question.correctAnswerIndex}`
    );
  }

  // ==========================================================
  // EXPLANATION
  // ==========================================================

  const explanation =
    normalizeText(
      question.explanation
    ) || null;

  // if (!explanation) {
  //   throw new Error(
  //     `Question ${index + 1} has no explanation.`
  //   );
  // }

  // ==========================================================
  // RETURN CLEAN QUESTION
  // ==========================================================

  return {
    text: questionText,

    options,

    correctAnswerIndex,

    correctAnswer:
      options[correctAnswerIndex],

    explanation,
  };
}

// ============================================================
// GENERATE QUIZ
// ============================================================

export async function generateQuizForTopic(
  topicId
) {
  // ==========================================================
  // FETCH TOPIC
  // ==========================================================

  const topic =
    await db.topic.findUnique({
      where: {
        id: topicId,
      },

      include: {
        class: true,
        subject: true,
      },
    });

  if (!topic) {
    throw new Error(
      "Topic not found"
    );
  }

  // ==========================================================
  // VALIDATE LESSON CONTENT
  // ==========================================================

  if (
    !Array.isArray(
      topic.lessonContents
    ) ||
    topic.lessonContents.length === 0
  ) {
    throw new Error(
      `Topic ${topicId} has no lesson content for quiz generation.`
    );
  }

  // ==========================================================
  // FORMAT LESSON CONTENT
  // ==========================================================

  const lessonContent =
    topic.lessonContents
      .map(
        (content, index) => `
Section ${index + 1}

Content:
${content}
`
      )
      .join("\n");

  // ==========================================================
  // GEMINI MODEL
  // ==========================================================

  const model =
    genAI.getGenerativeModel({
      model: "gemini-2.5-flash",

      generationConfig: {
        responseMimeType:
          "application/json",

        responseSchema:
          quizResponseSchema,

        temperature: 0.4,
      },
    });

  // ==========================================================
  // PROMPT
  // ==========================================================

  const prompt = `
You are an expert teacher, curriculum specialist,
and assessment designer.

Generate a comprehensive multiple-choice quiz
from the supplied lesson content.

Subject:
${topic.subject.name}

Topic:
${topic.title}

Class Level:
${topic.class.name}

Lesson Content:

${lessonContent}

IMPORTANT INSTRUCTIONS:

1. Generate approximately 20 questions.

2. 20 questions is the requested target.

3. If you naturally generate slightly more
   or fewer questions, return the questions
   you generated.

4. Do NOT invent, duplicate, or artificially
   create questions simply to reach exactly 20.

5. Every question must be based strictly
   on the supplied lesson content.

6. Cover the important concepts contained
   in the lesson.

7. Mix easy, medium, and difficult questions
   appropriate for the class level.

8. Every question must have exactly four
   distinct answer options.

9. The four options must be meaningfully
   different from one another.

10. NEVER repeat an option within the same
    question.

11. NEVER create two options that are merely
    different wording of the same answer.

12. Only ONE option must be correct.

13. correctAnswerIndex MUST identify the
    correct option using zero-based indexing.

14. The options are indexed:

    Option 0
    Option 1
    Option 2
    Option 3

15. correctAnswerIndex must therefore be
    0, 1, 2, or 3.

16. Do NOT return the correct answer as text
    in correctAnswerIndex.

17. The correct answer must correspond exactly
    to the option identified by correctAnswerIndex.

18. Do not create questions whose answers depend
    on information outside the supplied lesson.

19. Do not invent facts, concepts, examples,
    formulas, terminology, or definitions that
    are not supported by the lesson.

20. Avoid ambiguous questions.

21. Avoid questions where more than one option
    could reasonably be considered correct.

22. Make incorrect options plausible but clearly
    incorrect based on the lesson.

23. Do not make incorrect options so obviously
    wrong that the answer can be identified
    without understanding the lesson.

24. For EVERY question, generate an explanation
    for the correct answer.

25. The explanation must explain WHY the selected
    answer is correct.

26. The explanation must be educational and
    appropriate for the class level.

27. The explanation should be concise but useful
    to a student who has just answered the question.

28. Do not merely say:
    "The correct answer is ..."

29. Do not introduce information unrelated to
    the question.

30. Do not contradict the lesson content.

31. The explanation must agree with the actual
    correct option identified by correctAnswerIndex.

32. Do not include explanations for the incorrect
    options.

33. Do not include markdown in the explanation.

34. Do not include markdown in the quiz response.

35. Return valid JSON matching the supplied schema.

36. Before returning the quiz, check every question:

    a. Exactly four options exist.

    b. All four options are different.

    c. No two options express the same answer.

    d. Exactly one option is correct.

    e. correctAnswerIndex identifies the correct option.

    f. The explanation describes why that exact
       option is correct.

    g. The question can be answered using only
       the supplied lesson content.

    h. The explanation does not introduce
       unsupported information.

37. If you generate fewer or more than 20 questions,
    return the questions generated.

38. Do NOT add artificial, duplicated, or unsupported
    questions merely to reach 20.
`;

  // ==========================================================
  // GENERATE QUIZ
  // ==========================================================

  console.log(
    `📝 Generating quiz, answers, and explanations for topic ${topicId}...`
  );

  const result =
    await model.generateContent(prompt);

  const rawResponse =
    result.response.text();

  // ==========================================================
  // PARSE JSON
  // ==========================================================

  let quizData;

  try {
    quizData =
      JSON.parse(rawResponse);
  } catch (error) {
    console.error(
      "❌ Failed to parse quiz JSON."
    );

    console.error(
      rawResponse
    );

    throw new Error(
      "Invalid quiz response from Gemini."
    );
  }

  // ==========================================================
  // VALIDATE QUIZ OBJECT
  // ==========================================================

  if (
    !quizData ||
    typeof quizData !== "object"
  ) {
    throw new Error(
      "Gemini returned an invalid quiz object."
    );
  }

  if (
    !Array.isArray(
      quizData.questions
    )
  ) {
    throw new Error(
      "Gemini returned an invalid questions array."
    );
  }

  // ==========================================================
  // VALIDATE QUESTION COUNT
  // ==========================================================

  const generatedQuestionCount =
    quizData.questions.length;

  if (
    generatedQuestionCount === 0
  ) {
    throw new Error(
      "Gemini generated no quiz questions."
    );
  }

  if (
    generatedQuestionCount !== 20
  ) {
    console.warn(
      `⚠️ Gemini was asked to generate 20 questions but generated ${generatedQuestionCount}. Proceeding with the generated questions.`
    );
  }

  // ==========================================================
  // VALIDATE INDIVIDUAL QUESTIONS
  // ==========================================================

  const questions = [];

  let invalidQuestionCount = 0;

  for (
    let index = 0;
    index < quizData.questions.length;
    index++
  ) {
    const question =
      quizData.questions[index];

    try {
      const validatedQuestion =
        validateQuestion(
          question,
          index
        );

      questions.push(
        validatedQuestion
      );
    } catch (error) {
      invalidQuestionCount++;

      console.warn(
        `⚠️ Skipping invalid question ${index + 1}: ${error.message}`
      );

      if (
        question &&
        typeof question === "object"
      ) {
        console.warn(
          `Question: ${normalizeText(question.text)}`
        );
      }
    }
  }

  // ==========================================================
  // FINAL VALIDATION
  // ==========================================================

  if (
    questions.length === 0
  ) {
    throw new Error(
      "Gemini generated questions, but none passed validation."
    );
  }

  // ==========================================================
  // VALIDATION SUMMARY
  // ==========================================================

  console.log(
    `📊 Quiz validation summary for topic ${topicId}:`
  );

  console.log(
    `   Generated: ${generatedQuestionCount}`
  );

  console.log(
    `   Valid: ${questions.length}`
  );

  console.log(
    `   Skipped: ${invalidQuestionCount}`
  );

  console.log(
    `   Explanations generated: ${questions.filter(
      (question) =>
        Boolean(question.explanation)
    ).length}`
  );

  // ==========================================================
  // SAVE QUIZ AND QUESTIONS
  // ==========================================================

  console.log(
    `💾 Saving quiz, questions, answers, and explanations for topic ${topicId}...`
  );

  const quiz =
    await db.quiz.create({
      data: {
        title:
          normalizeText(
            quizData.title
          ) ||
          `${topic.title} Quiz`,

        topicId:
          topic.id,

        questions: {
          create:
            questions.map(
              (question) => ({
                text:
                  question.text,

                correctAnswer:
                  question.correctAnswer,

                explanation:
                  question.explanation,

                options:
                  question.options,
              })
            ),
        },
      },

      include: {
        questions: true,
      },
    });

  // ==========================================================
  // SUCCESS
  // ==========================================================

  console.log(
    `✅ Quiz generated successfully: ${quiz.id}`
  );

  console.log(
    `📚 Questions saved: ${quiz.questions.length}`
  );

  if (
    invalidQuestionCount > 0
  ) {
    console.log(
      `⚠️ ${invalidQuestionCount} invalid question(s) were skipped.`
    );
  }

  return quiz;
}


// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { db } from "../../../lib/db.js";

// const genAI = new GoogleGenerativeAI(
//   process.env.GEMINI_API_KEY
// );

// // =====================================
// // RESPONSE SCHEMA
// // =====================================

// const quizResponseSchema = {
//   type: "object",

//   properties: {
//     title: {
//       type: "string",
//     },

//     questions: {
//       type: "array",

//       items: {
//         type: "object",

//         properties: {
//           text: {
//             type: "string",
//           },

//           options: {
//             type: "array",

//             items: {
//               type: "string",
//             },

//             minItems: 4,
//             maxItems: 4,
//           },

//           // IMPORTANT:
//           // Gemini returns the index of the correct option
//           // instead of repeating the answer text.
//           correctAnswerIndex: {
//             type: "integer",
//             minimum: 0,
//             maximum: 3,
//           },
//         },

//         required: [
//           "text",
//           "options",
//           "correctAnswerIndex",
//         ],
//       },
//     },
//   },

//   required: [
//     "title",
//     "questions",
//   ],
// };

// // =====================================
// // NORMALIZE TEXT
// // =====================================

// function normalizeText(value) {
//   return String(value ?? "")
//     .trim()
//     .replace(/\s+/g, " ");
// }

// // =====================================
// // VALIDATE QUESTION
// // =====================================

// function validateQuestion(question, index) {
//   if (!question || typeof question !== "object") {
//     throw new Error(
//       `Invalid question at index ${index}.`
//     );
//   }

//   // -------------------------------------
//   // QUESTION TEXT
//   // -------------------------------------

//   const questionText =
//     normalizeText(question.text);

//   if (!questionText) {
//     throw new Error(
//       `Question ${index + 1} has no question text.`
//     );
//   }

//   // -------------------------------------
//   // OPTIONS
//   // -------------------------------------

//   if (!Array.isArray(question.options)) {
//     throw new Error(
//       `Question ${index + 1} has invalid options.`
//     );
//   }

//   if (question.options.length !== 4) {
//     throw new Error(
//       `Question ${index + 1} must contain exactly four options.`
//     );
//   }

//   const options =
//     question.options.map(normalizeText);

//   // -------------------------------------
//   // EMPTY OPTIONS
//   // -------------------------------------

//   if (
//     options.some(
//       (option) => !option
//     )
//   ) {
//     throw new Error(
//       `Question ${index + 1} contains an empty option.`
//     );
//   }

//   // -------------------------------------
//   // DUPLICATE OPTIONS
//   // -------------------------------------

//   const uniqueOptions =
//     new Set(
//       options.map((option) =>
//         option.toLowerCase()
//       )
//     );

//   if (uniqueOptions.size !== 4) {
//     throw new Error(
//       `Question ${index + 1} contains duplicate options.`
//     );
//   }

//   // -------------------------------------
//   // CORRECT ANSWER INDEX
//   // -------------------------------------

//   const correctAnswerIndex =
//     Number(question.correctAnswerIndex);

//   if (
//     !Number.isInteger(
//       correctAnswerIndex
//     ) ||
//     correctAnswerIndex < 0 ||
//     correctAnswerIndex > 3
//   ) {
//     throw new Error(
//       `Question ${index + 1} has an invalid correctAnswerIndex: ${question.correctAnswerIndex}`
//     );
//   }

//   // -------------------------------------
//   // RETURN CLEAN QUESTION
//   // -------------------------------------

//   return {
//     text: questionText,
//     options,
//     correctAnswerIndex,
//     correctAnswer:
//       options[correctAnswerIndex],
//   };
// }

// // =====================================
// // GENERATE QUIZ
// // =====================================

// export async function generateQuizForTopic(
//   topicId
// ) {
//   // =====================================
//   // FETCH TOPIC
//   // =====================================

//   const topic =
//     await db.topic.findUnique({
//       where: {
//         id: topicId,
//       },

//       include: {
//         class: true,
//         subject: true,
//       },
//     });

//   if (!topic) {
//     throw new Error(
//       "Topic not found"
//     );
//   }

//   // =====================================
//   // VALIDATE LESSON CONTENT
//   // =====================================

//   if (
//     !Array.isArray(
//       topic.lessonContents
//     ) ||
//     topic.lessonContents.length === 0
//   ) {
//     throw new Error(
//       `Topic ${topicId} has no lesson content for quiz generation.`
//     );
//   }

//   // =====================================
//   // FORMAT CONTENT
//   // =====================================

//   const lessonContent =
//     topic.lessonContents
//       .map(
//         (content, index) => `
//         Section ${index + 1}

//         Content:
//         ${content}
//         `
//       )
//       .join("\n");

//   // =====================================
//   // GEMINI MODEL
//   // =====================================

//   const model =
//     genAI.getGenerativeModel({
//       model: "gemini-2.5-flash",

//       generationConfig: {
//         responseMimeType:
//           "application/json",

//         responseSchema:
//           quizResponseSchema,

//         temperature: 0.4,
//       },
//     });

//   // =====================================
//   // PROMPT
//   // =====================================

//   const prompt = `
//     You are an expert teacher and assessment specialist.

//     Generate a comprehensive multiple-choice quiz
//     from the lesson below.

//     Subject:
//     ${topic.subject.name}

//     Topic:
//     ${topic.title}

//     Class Level:
//     ${topic.class.name}

//     Lesson Content:

//     ${lessonContent}

//     IMPORTANT INSTRUCTIONS:

//     1. Generate approximately 20 questions,
//        targeting 20 questions.

//        20 questions is the requested target.

//        However, if you naturally generate slightly
//        more or fewer questions, return the questions
//        you generated.

//        Do NOT invent, duplicate, or artificially
//        create questions simply to reach exactly 20.

//     2. Every question must be based strictly
//        on the supplied lesson content.

//     3. Cover all important concepts in the lesson.

//     4. Mix easy, medium, and difficult questions.

//     5. Every question must have exactly four
//        distinct answer options.

//     6. The four options must be meaningfully
//        different from one another.

//     7. NEVER repeat an option within the same
//        question.

//     8. NEVER create two options that are merely
//        different wording of the same answer.

//     9. Avoid options that are identical except
//        for capitalization, punctuation, or minor
//        wording changes.

//     10. Only ONE option must be correct.

//     11. correctAnswerIndex MUST identify the
//         correct option using zero-based indexing.

//     12. The four options are indexed as:

//         Option 0
//         Option 1
//         Option 2
//         Option 3

//     13. correctAnswerIndex MUST therefore be
//         one of:

//         0
//         1
//         2
//         3

//     14. Do NOT return the correct answer as text.
//         Return only its numeric index.

//     15. Do not create questions whose answers
//         depend on information outside the lesson.

//     16. Do not invent facts, concepts, examples,
//         formulas, terminology, or definitions
//         that are not supported by the lesson.

//     17. Avoid ambiguous questions.

//     18. Avoid questions where more than one option
//         could reasonably be considered correct.

//     19. Make the incorrect options plausible but
//         clearly incorrect based on the lesson.

//     20. Do not make the incorrect options so
//         obviously wrong that the answer can be
//         identified without understanding the lesson.

//     21. Do not include explanations.

//     22. Do not include markdown.

//     23. Return valid JSON matching the supplied schema.

//     24. If you generate fewer or more than 20
//         questions, return the questions generated.

//         Do NOT add artificial, duplicated, or
//         unsupported questions merely to reach 20.

//     25. Before returning the quiz, check every
//         question and make sure:

//         a. It has exactly four options.

//         b. All four options are different.

//         c. No two options express the same answer.

//         d. Exactly one option is correct.

//         e. correctAnswerIndex points to the
//            correct option.

//         f. The question can be answered using
//            only the supplied lesson content.
//   `;

//   // =====================================
//   // GENERATE QUIZ
//   // =====================================

//   console.log(
//     `📝 Generating quiz for topic ${topicId}...`
//   );

//   const result =
//     await model.generateContent(prompt);

//   const rawResponse =
//     result.response.text();

//   // =====================================
//   // PARSE JSON
//   // =====================================

//   let quizData;

//   try {
//     quizData =
//       JSON.parse(rawResponse);
//   } catch (error) {
//     console.error(
//       "❌ Failed to parse quiz JSON"
//     );

//     console.error(
//       rawResponse
//     );

//     throw new Error(
//       "Invalid quiz response from Gemini."
//     );
//   }

//   // =====================================
//   // VALIDATE QUIZ STRUCTURE
//   // =====================================

//   if (
//     !quizData ||
//     typeof quizData !== "object"
//   ) {
//     throw new Error(
//       "Gemini returned an invalid quiz object."
//     );
//   }

//   if (
//     !Array.isArray(
//       quizData.questions
//     )
//   ) {
//     throw new Error(
//       "Gemini returned an invalid questions array."
//     );
//   }

//   // =====================================
//   // VALIDATE QUESTION COUNT
//   // =====================================

//   const generatedQuestionCount =
//     quizData.questions.length;

//   if (
//     generatedQuestionCount === 0
//   ) {
//     throw new Error(
//       "Gemini generated no quiz questions."
//     );
//   }

//   // 20 is the target, NOT a hard requirement.
//   //
//   // Gemini may occasionally generate more
//   // or fewer questions.
//   //
//   // As long as questions were generated,
//   // continue with individual validation
//   // and save all valid questions.

//   if (
//     generatedQuestionCount !== 20
//   ) {
//     console.warn(
//       `⚠️ Gemini was asked to generate 20 questions but generated ${generatedQuestionCount}. Proceeding with the generated questions.`
//     );
//   }

//   // =====================================
//   // VALIDATE QUESTIONS INDIVIDUALLY
//   // =====================================

//   const questions = [];

//   let invalidQuestionCount = 0;

//   for (
//     let index = 0;
//     index < quizData.questions.length;
//     index++
//   ) {
//     const question =
//       quizData.questions[index];

//     try {
//       const validatedQuestion =
//         validateQuestion(
//           question,
//           index
//         );

//       questions.push(
//         validatedQuestion
//       );
//     } catch (error) {
//       invalidQuestionCount++;

//       console.warn(
//         `⚠️ Skipping invalid question ${index + 1}: ${error.message}`
//       );

//       if (
//         question &&
//         typeof question === "object"
//       ) {
//         console.warn(
//           `Question: ${normalizeText(question.text)}`
//         );
//       }
//     }
//   }

//   // =====================================
//   // VALIDATE FINAL QUESTION RESULT
//   // =====================================

//   if (
//     questions.length === 0
//   ) {
//     throw new Error(
//       "Gemini generated questions, but none passed validation."
//     );
//   }

//   // =====================================
//   // LOG VALIDATION SUMMARY
//   // =====================================

//   console.log(
//     `📊 Quiz validation summary for topic ${topicId}:`
//   );

//   console.log(
//     `   Generated: ${generatedQuestionCount}`
//   );

//   console.log(
//     `   Valid: ${questions.length}`
//   );

//   console.log(
//     `   Skipped: ${invalidQuestionCount}`
//   );

//   // =====================================
//   // SAVE QUIZ
//   // =====================================

//   console.log(
//     `💾 Saving quiz for topic ${topicId}...`
//   );

//   /*
//    * Only validated questions are saved.
//    *
//    * Invalid questions are skipped individually
//    * instead of causing the entire quiz generation
//    * to fail.
//    *
//    * The number of generated questions is not
//    * required to be exactly 20.
//    */

//   const quiz =
//     await db.quiz.create({
//       data: {
//         title:
//           normalizeText(
//             quizData.title
//           ) ||
//           `${topic.title} Quiz`,

//         topicId:
//           topic.id,

//         questions: {
//           create:
//             questions.map(
//               (question) => ({
//                 text:
//                   question.text,

//                 correctAnswer:
//                   question.correctAnswer,

//                 options:
//                   question.options,
//               })
//             ),
//         },
//       },

//       include: {
//         questions: true,
//       },
//     });

//   // =====================================
//   // SUCCESS
//   // =====================================

//   console.log(
//     `✅ Quiz generated successfully: ${quiz.id}`
//   );

//   console.log(
//     `📚 Questions saved: ${quiz.questions.length}`
//   );

//   if (
//     invalidQuestionCount > 0
//   ) {
//     console.log(
//       `⚠️ ${invalidQuestionCount} invalid question(s) were skipped.`
//     );
//   }

//   return quiz;
// }
