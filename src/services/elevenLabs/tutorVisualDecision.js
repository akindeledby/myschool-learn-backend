
import { ai } from "../../../lib/gemini.js";

/*
==========================================
VISUAL PRIORITY LEVELS
==========================================

none:
  A visual provides no meaningful benefit.

low:
  A visual could be useful, but the tutor
  explanation works perfectly well without it.

high:
  A visual would significantly improve the
  student's understanding.

extremely_high:
  The subject is strongly visual and a
  visual is exceptionally valuable or
  practically essential to understanding.

IMPORTANT:
Only "high" and "extremely_high" can trigger
automatic image generation.

Maximum images are controlled separately by
createTutorImage().
==========================================
*/

/*
==========================================
DETERMINE WHETHER A VISUAL IS USEFUL
==========================================
*/

export async function determineTutorVisual({
  studentMessage,
  tutorResponse,
}) {
  /*
  ========================================
  VALIDATE INPUT
  ========================================
  */

  if (
    !studentMessage?.trim() ||
    !tutorResponse?.trim()
  ) {
    return {
      shouldGenerate: false,
      priority: "none",
      prompt: null,
      alt: null,
      caption: null,
    };
  }

  try {
    /*
    ======================================
    ASK GEMINI TO CLASSIFY VISUAL VALUE
    ======================================
    */

    const response =
      await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",

        contents: `
You are the visual decision system for an educational AI tutor.

Your job is to decide whether the tutor's response genuinely benefits from a generated educational image.

IMPORTANT:
Do NOT generate an image simply because the topic can be illustrated.

The default decision should be "none" or "low".

Only choose "high" or "extremely_high" when the visual provides substantial educational value.

Student question:
${studentMessage}

Tutor response:
${tutorResponse}


==========================================
PRIORITY LEVELS
==========================================

"none"

Use this when an image provides little or no educational benefit.

Examples:
1. Greetings.
2. Simple conversational responses.
3. Simple definitions.
4. Simple calculations.
5. Straightforward factual answers.
6. Grammar corrections.
7. Short explanations that are already clear in text.
8. Questions where an image would merely decorate the response.


"low"

Use this when an image could make the response slightly more interesting or easier to understand, but the explanation does not meaningfully depend on a visual.

IMPORTANT:
"low" MUST NOT automatically generate an image.


"high"

Use this when a visual would significantly improve understanding.

Examples:
1. A labeled diagram of a biological structure.
2. A map needed to understand a geographical explanation.
3. A graph that materially helps explain a mathematical concept.
4. A visual comparison between scientific concepts.
5. A process that is substantially easier to understand visually.
6. A complex structure where labels and spatial relationships matter.


"extremely_high"

Use this only when the subject is strongly visual and a visual is exceptionally valuable or practically essential to understanding.

Examples:
1. Human anatomy requiring a labeled body diagram.
2. A complex biological structure where spatial relationships are central.
3. A scientific process that is difficult to understand without seeing the stages.
4. A geography question explicitly requiring a map.
5. A question explicitly requesting a diagram, picture, illustration, chart, map, or visual.
6. A mathematical graphing question where the graph itself is central to the explanation.
7. A complex system whose components and relationships are best understood visually.

Do NOT use "extremely_high" merely because the topic is interesting.


==========================================
IMPORTANT IMAGE RULES
==========================================

The following should normally NOT generate images:

1. Simple arithmetic.
2. Basic algebra calculations.
3. Simple definitions.
4. Short factual questions.
5. Greetings.
6. Casual conversation.
7. Simple grammar questions.
8. Simple vocabulary questions.
9. Questions that can be completely and clearly answered with text.
10. Responses where an image would only be decorative.


==========================================
EXPLICIT VISUAL REQUESTS
==========================================

If the student explicitly asks for:

1. A diagram.
2. A picture.
3. An illustration.
4. A chart.
5. A graph.
6. A map.
7. A labeled structure.
8. A visual representation.

then the priority should normally be "extremely_high" if the requested visual is genuinely educationally relevant.

However, do not generate an image if the request is impossible, inappropriate, misleading, or unnecessary.


==========================================
IMAGE QUALITY REQUIREMENTS
==========================================

If an image is appropriate, create a detailed image generation prompt.

The image must be:

1. Suitable for school students.
2. Educational.
3. Clear and easy to understand.
4. Accurate to the tutor's explanation.
5. Appropriate for the student's academic level.
6. Focused on the educational concept.
7. Free from unnecessary decorative elements.
8. Free from sexual content.
9. Free from violent or graphic content.
10. Free from inappropriate material.


==========================================
AVOID DUPLICATION
==========================================

Do not request an image when the tutor response does not introduce a distinct visual concept.

A long tutor response does NOT automatically justify an image.

Do not generate multiple visual ideas inside one image prompt unless they are naturally part of the same educational diagram.


==========================================
DECISION
==========================================

Return ONLY valid JSON.

If no image is needed:

{
  "shouldGenerate": false,
  "priority": "none",
  "prompt": null,
  "alt": null,
  "caption": null
}

If a visual could be useful but is not important enough to generate:

{
  "shouldGenerate": false,
  "priority": "low",
  "prompt": null,
  "alt": null,
  "caption": null
}

If a visual would significantly improve understanding:

{
  "shouldGenerate": true,
  "priority": "high",
  "prompt": "Detailed educational image generation prompt",
  "alt": "Accessible description of the image",
  "caption": "Short educational caption"
}

If the visual is exceptionally valuable or practically essential:

{
  "shouldGenerate": true,
  "priority": "extremely_high",
  "prompt": "Detailed educational image generation prompt",
  "alt": "Accessible description of the image",
  "caption": "Short educational caption"
}

The priority MUST be exactly one of:

"none"
"low"
"high"
"extremely_high"
        `,

        config: {
          responseMimeType:
            "application/json",

          responseSchema: {
            type: "OBJECT",

            properties: {
              shouldGenerate: {
                type: "BOOLEAN",
              },

              priority: {
                type: "STRING",

                enum: [
                  "none",
                  "low",
                  "high",
                  "extremely_high",
                ],
              },

              prompt: {
                type: "STRING",
                nullable: true,
              },

              alt: {
                type: "STRING",
                nullable: true,
              },

              caption: {
                type: "STRING",
                nullable: true,
              },
            },

            required: [
              "shouldGenerate",
              "priority",
              "prompt",
              "alt",
              "caption",
            ],
          },
        },
      });

    /*
    ======================================
    READ GEMINI RESPONSE
    ======================================
    */

    const raw =
      response?.text?.trim();

    if (!raw) {
      return {
        shouldGenerate: false,
        priority: "none",
        prompt: null,
        alt: null,
        caption: null,
      };
    }

    /*
    ======================================
    PARSE JSON
    ======================================
    */

    const result =
      JSON.parse(raw);

    // console.log(
    //   "[TutorVisualDecision] Raw Gemini result:",
    //   raw
    // );

    // console.log(
    //   "[TutorVisualDecision] Parsed result:",
    //   result
    // );

    /*
    ======================================
    VALIDATE PRIORITY
    ======================================
    */

    const validPriorities = new Set([
      "none",
      "low",
      "high",
      "extremely_high",
    ]);

    const priority =
      validPriorities.has(
        result?.priority
      )
        ? result.priority
        : "none";

    /*
    ======================================
    ONLY HIGH AND EXTREMELY_HIGH CAN
    GENERATE AN IMAGE
    ======================================
    */

    const canGenerate =
      result?.shouldGenerate === true &&
      (
        priority === "high" ||
        priority === "extremely_high"
      ) &&
      typeof result?.prompt === "string" &&
      result.prompt.trim().length > 0;

    /*
    ======================================
    NO IMAGE
    ======================================
    */

    if (!canGenerate) {
      // console.log(
      //   "[TutorVisualDecision] Image not generated because:",
      //   {
      //     shouldGenerate:
      //       result?.shouldGenerate,

      //     priority,

      //     prompt:
      //       result?.prompt,

      //     alt:
      //       result?.alt,

      //     caption:
      //       result?.caption,
      //   }
      // );

      return {
        shouldGenerate: false,
        priority,
        prompt: null,
        alt: null,
        caption: null,
      };
    }

    /*
    ======================================
    IMAGE APPROVED
    ======================================
    */

    return {
      shouldGenerate: true,

      priority,

      prompt:
        result.prompt.trim(),

      alt:
        result.alt?.trim() ||
        "Educational illustration",

      caption:
        result.caption?.trim() ||
        undefined,
    };
  } catch (error) {
    console.error(
      "[TutorVisualDecision] Failed:",
      error
    );

    /*
    ======================================
    IMPORTANT

    Image generation must NEVER break
    the normal tutor response.
    ======================================
    */

    return {
      shouldGenerate: false,
      priority: "none",
      prompt: null,
      alt: null,
      caption: null,
    };
  }
}


// import { ai } from "../../../lib/gemini.js";

// /*
// ==========================================
// DETERMINE WHETHER A VISUAL IS USEFUL
// ==========================================
// */

// export async function determineTutorVisual({
//   studentMessage,
//   tutorResponse,
// }) {
//   if (
//     !studentMessage?.trim() ||
//     !tutorResponse?.trim()
//   ) {
//     return {
//       shouldGenerate: false,
//       prompt: null,
//       alt: null,
//       caption: null,
//     };
//   }

//   try {
//     const response =
//       await ai.models.generateContent({
//         model: "gemini-3.5-flash-lite",

//         contents: `
//             You are deciding whether an educational AI tutor response would benefit from ONE generated educational image.

//             Student question:
//             ${studentMessage}

//             Tutor response:
//             ${tutorResponse}

//             Generate an image ONLY when a visual would materially improve the student's understanding.

//             Good reasons to generate an image include:
//             1. The student explicitly asks for a diagram, picture, illustration, chart, map, graph, or visual.
//             2. The topic is naturally explained with a diagram or visual representation.
//             3. A labeled educational illustration would significantly improve understanding.

//             Do NOT generate an image for:
//             1. Simple calculations.
//             2. Simple definitions.
//             3. Greetings.
//             4. Short conversational responses.
//             5. Questions where an image adds little educational value.
//             6. Topics where a visual would be misleading or unnecessary.

//             If an image is appropriate, create a clear educational image prompt.

//             The image must be:
//             1. Suitable for school students.
//             2. Educational.
//             3. Clear and easy to understand.
//             4. Free from unnecessary decorative elements.
//             5. Appropriate for the student's academic level.
//             6. Free from sexual, violent, graphic, or otherwise inappropriate content.

//             Return ONLY valid JSON in this exact structure:

//             {
//             "shouldGenerate": true,
//             "prompt": "Detailed educational image generation prompt",
//             "alt": "Accessible description of the image",
//             "caption": "Short educational caption"
//             }

//             Or:

//             {
//             "shouldGenerate": false,
//             "prompt": null,
//             "alt": null,
//             "caption": null
//             }
//         `,

//         config: {
//           responseMimeType:
//             "application/json",

//           responseSchema: {
//             type: "OBJECT",

//             properties: {
//               shouldGenerate: {
//                 type: "BOOLEAN",
//               },

//               prompt: {
//                 type: "STRING",
//                 nullable: true,
//               },

//               alt: {
//                 type: "STRING",
//                 nullable: true,
//               },

//               caption: {
//                 type: "STRING",
//                 nullable: true,
//               },
//             },

//             required: [
//               "shouldGenerate",
//               "prompt",
//               "alt",
//               "caption",
//             ],
//           },
//         },
//       });

//     const raw =
//       response?.text?.trim();

//     if (!raw) {
//       return {
//         shouldGenerate: false,
//         prompt: null,
//         alt: null,
//         caption: null,
//       };
//     }

//     const result =
//       JSON.parse(raw);

//     console.log(
//       "[TutorVisualDecision] Raw Gemini result:",
//       raw
//     );

//     console.log(
//       "[TutorVisualDecision] Parsed result:",
//       result
//     );

//     if (
//       !result?.shouldGenerate ||
//       !result?.prompt?.trim()
//     ) {
//       console.log(
//         "[TutorVisualDecision] Image not generated because:",
//         {
//           shouldGenerate:
//             result?.shouldGenerate,

//           prompt:
//             result?.prompt,

//           alt:
//             result?.alt,

//           caption:
//             result?.caption,
//         }
//       );

//       return {
//         shouldGenerate: false,
//         prompt: null,
//         alt: null,
//         caption: null,
//       };
//     }

//     return {
//       shouldGenerate: true,

//       prompt:
//         result.prompt.trim(),

//       alt:
//         result.alt?.trim() ||
//         "Educational illustration",

//       caption:
//         result.caption?.trim() ||
//         undefined,
//     };
//   } catch (error) {
//     console.error(
//       "[TutorVisualDecision] Failed:",
//       error
//     );

//     /*
//     Image generation must NEVER
//     break the normal tutor response.
//     */

//     return {
//       shouldGenerate: false,
//       prompt: null,
//       alt: null,
//       caption: null,
//     };
//   }
// }