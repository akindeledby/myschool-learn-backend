import { ai } from "../../../lib/gemini.js";

const IMAGE_MODEL =
  "gemini-2.5-flash-image";

const MAX_RETRIES = 3;

/*
==========================================
GENERATE TUTOR IMAGE
==========================================
*/

export async function generateTutorImage({
  prompt,
}) {
  if (!prompt?.trim()) {
    throw new Error(
      "Image generation prompt is required."
    );
  }

  let lastError;

  /*
  ========================================
  RETRY IMAGE GENERATION
  ========================================
  */

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      console.log(
        `🎨 Tutor image generation attempt ${attempt}/${MAX_RETRIES}`
      );

      const response =
        await ai.models.generateContent({
          model: IMAGE_MODEL,

          contents: [
            {
              role: "user",

              parts: [
                {
                  text: `
                    Generate a clean educational illustration
                    for a school student.

                    Requirements:

                    • child friendly
                    • educational
                    • clear and easy to understand
                    • visually engaging
                    • simple uncluttered background
                    • classroom appropriate
                    • suitable for the student's class level
                    • no watermark
                    • no unnecessary text
                    • do not include decorative text unless explicitly requested
                    • accurately represent the subject described below

                    Image request:

                    ${prompt.trim()}
                  `.trim(),
                },
              ],
            },
          ],

          config: {
            responseModalities: [
              "TEXT",
              "IMAGE",
            ],
          },
        });

      const candidates =
        response?.candidates || [];

      if (!candidates.length) {
        throw new Error(
          "Gemini returned no candidates."
        );
      }

      const parts =
        candidates[0]?.content?.parts || [];

      let imagePart = null;
      let textPart = "";

      for (const part of parts) {
        if (part.text) {
          textPart += part.text;
        }

        if (
          part.inlineData?.data
        ) {
          imagePart =
            part.inlineData;
        }
      }

      if (!imagePart?.data) {
        throw new Error(
          "Gemini did not return an image."
        );
      }

      const buffer =
        Buffer.from(
          imagePart.data,
          "base64"
        );

      if (!buffer.length) {
        throw new Error(
          "Generated image buffer is empty."
        );
      }

      console.log(
        "✅ Tutor image generated successfully."
      );

      return {
        buffer,

        mimeType:
          imagePart.mimeType ||
          "image/png",

        model: IMAGE_MODEL,

        description:
          textPart.trim() || null,
      };

    } catch (error) {
      lastError = error;

      console.error(
        `❌ Tutor image generation attempt ${attempt} failed:`,
        error?.message || error
      );

      /*
      ======================================
      WAIT BEFORE RETRY
      ======================================
      */

      if (
        attempt < MAX_RETRIES
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              2000
            )
        );
      }
    }
  }

  throw lastError;
}