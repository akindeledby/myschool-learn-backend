import { ai } from "../../../lib/gemini.js";

/*
==========================================
DETERMINE WHETHER A VISUAL IS USEFUL
==========================================
*/

export async function determineTutorVisual({
  studentMessage,
  tutorResponse,
}) {
  if (
    !studentMessage?.trim() ||
    !tutorResponse?.trim()
  ) {
    return {
      shouldGenerate: false,
      prompt: null,
      alt: null,
      caption: null,
    };
  }

  try {
    const response =
      await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",

        contents: `
            You are deciding whether an educational AI tutor response would benefit from ONE generated educational image.

            Student question:
            ${studentMessage}

            Tutor response:
            ${tutorResponse}

            Generate an image ONLY when a visual would materially improve the student's understanding.

            Good reasons to generate an image include:
            1. The student explicitly asks for a diagram, picture, illustration, chart, map, graph, or visual.
            2. The topic is naturally explained with a diagram or visual representation.
            3. A labeled educational illustration would significantly improve understanding.

            Do NOT generate an image for:
            1. Simple calculations.
            2. Simple definitions.
            3. Greetings.
            4. Short conversational responses.
            5. Questions where an image adds little educational value.
            6. Topics where a visual would be misleading or unnecessary.

            If an image is appropriate, create a clear educational image prompt.

            The image must be:
            1. Suitable for school students.
            2. Educational.
            3. Clear and easy to understand.
            4. Free from unnecessary decorative elements.
            5. Appropriate for the student's academic level.
            6. Free from sexual, violent, graphic, or otherwise inappropriate content.

            Return ONLY valid JSON in this exact structure:

            {
            "shouldGenerate": true,
            "prompt": "Detailed educational image generation prompt",
            "alt": "Accessible description of the image",
            "caption": "Short educational caption"
            }

            Or:

            {
            "shouldGenerate": false,
            "prompt": null,
            "alt": null,
            "caption": null
            }
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
              "prompt",
              "alt",
              "caption",
            ],
          },
        },
      });

    const raw =
      response?.text?.trim();

    if (!raw) {
      return {
        shouldGenerate: false,
        prompt: null,
        alt: null,
        caption: null,
      };
    }

    const result =
      JSON.parse(raw);

    if (
      !result?.shouldGenerate ||
      !result?.prompt?.trim()
    ) {
      return {
        shouldGenerate: false,
        prompt: null,
        alt: null,
        caption: null,
      };
    }

    return {
      shouldGenerate: true,

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
    Image generation must NEVER
    break the normal tutor response.
    */

    return {
      shouldGenerate: false,
      prompt: null,
      alt: null,
      caption: null,
    };
  }
}