import { ai } from "../../../lib/gemini.js";

/*
==========================================
ASSIGNMENT VISUAL PRIORITY LEVELS
==========================================

none:

  A visual provides no meaningful educational
  benefit.

low:

  A visual could be useful, but the assignment
  can be understood and completed perfectly well
  without one.

high:

  A visual would significantly improve the
  student's understanding of the assignment.

extremely_high:

  The assignment is strongly visual, explicitly
  requests a visual, or the concept is difficult
  to understand without one.

Only "high" and "extremely_high" can trigger
automatic image generation.
==========================================
*/

const VALID_PRIORITIES = new Set([
  "none",
  "low",
  "high",
  "extremely_high",
]);

/*
==========================================
DETERMINE ASSIGNMENT VISUAL
==========================================
*/

export async function determineAssignmentVisual({
  studentQuestion,
  assignmentAnswer,
  classLevel,
}) {
  /*
  ========================================
  VALIDATE INPUT
  ========================================
  */

  if (
    !studentQuestion?.trim() &&
    !assignmentAnswer?.trim()
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
    ASK GEMINI TO DECIDE
    ======================================
    */

    const response =
      await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",

        contents: `
          You are the visual decision system for a school Homework and Assignment Helper.

          Your job is to determine whether a generated educational image would genuinely help a student understand or complete the assignment.

          Do NOT generate an image simply because the topic can be illustrated.

          The default decision must be "none" or "low".

          Only choose "high" or "extremely_high" when a visual provides substantial educational value.

          The student is in:

          ${classLevel || "Unknown class level"}


          ==========================================
          STUDENT'S ASSIGNMENT QUESTION
          ==========================================

          ${studentQuestion?.trim() || "No typed question provided."}


          ==========================================
          HOMEWORK HELPER ANSWER
          ==========================================

          ${assignmentAnswer?.trim() || "No explanation available."}


          ==========================================
          PRIORITY LEVELS
          ==========================================

          "none"

          Use this when an image provides little or no
          educational benefit.

          Examples:

          1. Simple definitions.
          2. Simple arithmetic.
          3. Basic algebra calculations.
          4. Short factual questions.
          5. Grammar corrections.
          6. Vocabulary questions.
          7. Questions that can be clearly answered with text.
          8. Questions where an image would only be decorative.


          "low"

          Use this when an image could make the answer
          more interesting or slightly easier to understand,
          but the student does not need the image.

          IMPORTANT:

          "low" MUST NOT automatically generate an image.


          "high"

          Use this when a visual would significantly improve
          the student's understanding.

          Examples:

          1. A labelled plant cell diagram.
          2. A labelled human body structure.
          3. A diagram explaining a scientific process.
          4. A map that helps explain a geographical concept.
          5. A graph that materially helps explain a mathematical concept.
          6. A visual comparison between scientific concepts.
          7. A diagram showing components of a machine.
          8. A process that is substantially easier to understand visually.
          9. A geometry question where the shape is central to solving it.
          10. A physics question requiring a useful diagram.


          "extremely_high"

          Use this only when the visual is exceptionally valuable
          or practically essential.

          Examples:

          1. The student explicitly asks for a diagram.
          2. The student explicitly asks for a picture.
          3. The student explicitly asks for a graph.
          4. The student explicitly asks for a map.
          5. The student explicitly asks for an illustration.
          6. A complex biological structure where spatial relationships matter.
          7. A scientific process that is difficult to understand without seeing its stages.
          8. A mathematical graphing question where the graph itself is central.
          9. A technical structure that requires labelled components.
          10. An assignment instruction that specifically requires a visual representation.


          ==========================================
          DO NOT GENERATE IMAGES FOR
          ==========================================

          1. Simple arithmetic.
          2. Basic algebra calculations.
          3. Simple definitions.
          4. Simple factual questions.
          5. Simple vocabulary questions.
          6. Simple grammar questions.
          7. Short written answers.
          8. Essay questions where an image is unnecessary.
          9. Questions that are completely understandable through text.
          10. Images that would only decorate the answer.


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
          7. A labelled structure.
          8. A visual representation.

          then normally use "extremely_high" when the requested visual
          is educationally relevant.


          ==========================================
          IMAGE REQUIREMENTS
          ==========================================

          When an image is appropriate, create a detailed image
          generation prompt.

          The generated image must be:

          1. Educational.
          2. Accurate.
          3. Suitable for the student's class level.
          4. Child friendly.
          5. Classroom appropriate.
          6. Clear and easy to understand.
          7. Focused on the assignment concept.
          8. Visually simple and uncluttered.
          9. Free from unnecessary decoration.
          10. Free from sexual content.
          11. Free from graphic or violent content.
          12. Free from inappropriate material.
          13. Free from unnecessary text.

          If labels are educationally necessary, labels may be
          included in the image.

          Do not add decorative headings, slogans or unnecessary
          text.


          ==========================================
          IMPORTANT ACCURACY RULE
          ==========================================

          The image must support the actual assignment answer.

          Do not create an image containing information that
          contradicts the Homework Helper explanation.

          Do not invent facts merely to make an attractive image.

          If a diagram is needed, focus on the exact concept
          being explained.


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

          If a visual could be useful but is not important enough
          to generate:

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

          If a visual is exceptionally valuable:

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
        `.trim(),

        config: {
          responseMimeType: "application/json",

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
    READ RESPONSE
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

    /*
    ======================================
    VALIDATE PRIORITY
    ======================================
    */

    const priority =
      VALID_PRIORITIES.has(
        result?.priority
      )
        ? result.priority
        : "none";

    /*
    ======================================
    ONLY HIGH AND EXTREMELY_HIGH
    CAN GENERATE
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
    IMAGE NOT APPROVED
    ======================================
    */

    if (!canGenerate) {
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
        typeof result?.alt === "string" &&
        result.alt.trim()
          ? result.alt.trim()
          : "Educational illustration",

      caption:
        typeof result?.caption === "string" &&
        result.caption.trim()
          ? result.caption.trim()
          : null,
    };

  } catch (error) {
    console.error(
      "[AssignmentVisualDecision] Failed:",
      error
    );

    /*
    ======================================
    IMPORTANT

    Image generation must NEVER break
    a perfectly valid homework answer.
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