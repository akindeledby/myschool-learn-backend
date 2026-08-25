import { GoogleGenAI } from "@google/genai";
import { LessonPlanSchema } from "./schemas/lesson-plan.schema.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-2.5-flash";

function extractJson(raw) {
  if (!raw) {
    return null;
  }

  const match = raw.match(
    /\{[\s\S]*\}/
  );

  if (!match) {
    return null;
  }

  return match[0];
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function generateLessonPlan({
  cacheName,
}) {
  const MAX_RETRIES = 5;

  // ============================================================
  // LESSON SPECIFIC REQUEST
  // ============================================================

  const prompt = `
    Generate the lesson plan using the lesson planning instructions
    and lesson context stored in the cache.

    Return ONLY valid JSON.

    Do not include markdown.

    Do not include explanations.

    Do not include commentary.

    The response must strictly follow the required lesson plan schema.
  `;

  // ============================================================
  // GENERATE LESSON PLAN
  // ============================================================

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const result =
        await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            cachedContent: cacheName,
            temperature: 0.4,
            responseMimeType:
              "application/json",
          },
        });

      // ========================================================
      // EXTRACT RESPONSE
      // ========================================================

      const raw =
        result.text || "";

      const jsonString =
        extractJson(raw);

      if (!jsonString) {
        throw new Error(
          "No JSON found in response"
        );
      }

      // ========================================================
      // PARSE JSON
      // ========================================================

      let parsed;

      try {
        parsed =
          JSON.parse(jsonString);
      } catch (error) {
        console.error(
          "Failed JSON response:",
          jsonString
        );

        throw new Error(
          "Invalid JSON returned"
        );
      }

      // ========================================================
      // VALIDATE LESSON PLAN
      // ========================================================

      const validation =
        LessonPlanSchema.safeParse(
          parsed
        );

      if (!validation.success) {
        console.error(
          "Schema validation failed:",
          validation.error.flatten()
        );

        throw new Error(
          "Lesson schema validation failed"
        );
      }

      // ========================================================
      // SUCCESS
      // ========================================================

      return validation.data;

    } catch (error) {
      console.error(
        `Lesson planning attempt ${
          attempt + 1
        } failed:`,
        error.message
      );

      // ========================================================
      // RATE LIMIT
      // ========================================================

      if (
        error.message?.includes("429")
      ) {
        console.log(
          "Rate limit detected. Waiting 45 seconds before retry..."
        );

        await sleep(45000);
      }

      // ========================================================
      // FINAL FAILURE
      // ========================================================

      if (
        attempt === MAX_RETRIES
      ) {
        throw new Error(
          "Lesson planning failed after retries"
        );
      }

      // ========================================================
      // GENERAL RETRY DELAY
      // ========================================================

      await sleep(5000);
    }
  }
}



// import { GoogleGenAI } from "@google/genai";
// import { buildScenePlanningPrompt } from "./scene-planner.service.js";
// import { LessonPlanSchema } from "./schemas/lesson-plan.schema.js";

// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// function extractJson(raw) {
//   if (!raw) return null;

//   const match = raw.match(/\{[\s\S]*\}/);

//   if (!match) {
//     return null;
//   }

//   return match[0];
// }

// function sleep(ms) {
//   return new Promise((resolve) =>
//     setTimeout(resolve, ms)
//   );
// }

// export async function generateLessonPlan({
//   subject,
//   classLevel,
//   topic,
//   lessonContents
// }) {
//   const basePrompt =
//     buildScenePlanningPrompt({
//       subject,
//       topic,
//       lessonContents,
//       classLevel,
//     });

//   const MAX_RETRIES = 5;

//   for (
//     let attempt = 0;
//     attempt <= MAX_RETRIES;
//     attempt++
//   ) {
//     try {
//       const prompt =
//         attempt === 0
//           ? basePrompt
//           : `
//           ${basePrompt}

//           IMPORTANT:
//           Return ONLY valid JSON.
//           No markdown.
//           No explanation.
//           No extra text.
//           `;

//       const result =
//         await ai.models.generateContent({
//           model: "gemini-2.5-flash",
//           contents: prompt,
//           config: {
//             temperature: 0.4,
//             responseMimeType:
//               "application/json",
//           },
//         });

//       const raw =
//         result.text || "";

//       const jsonString =
//         extractJson(raw);

//       if (!jsonString) {
//         throw new Error(
//           "No JSON found in response"
//         );
//       }

//       let parsed;

//       try {
//         parsed =
//           JSON.parse(jsonString);

//       } catch (error) {
//         throw new Error(
//           "Invalid JSON returned"
//         );
//       }

//       const validation =
//         LessonPlanSchema.safeParse(
//           parsed
//         );

//       if (!validation.success) {
//         console.error(
//           "Schema validation failed:",
//           validation.error.flatten()
//         );

//         throw new Error(
//           "Lesson schema validation failed"
//         );
//       }

//       return validation.data;

//     } catch (error) {
//       console.error(
//         `Lesson planning attempt ${
//           attempt + 1
//         } failed:`,
//         error.message
//       );

//       if (
//         error.message?.includes("429")
//       ) {
//         console.log(
//           "Rate limit-lesson planner - Waiting before retry..."
//         );

//         await sleep(45000);
//       }

//       if (
//         attempt === MAX_RETRIES
//       ) {
//         throw new Error(
//           "Lesson planning failed after retries"
//         );
//       }

//       await sleep(5000);
//     }
//   }
// }