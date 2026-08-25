import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

interface GenerateExplanationParams {
  prompt: string;
  fileBuffer?: Buffer;
  mimeType?: string;
}

export async function generateAssignmentExplanation({
  prompt,
  fileBuffer,
  mimeType,
}: GenerateExplanationParams) {
  try {
    let response;

    // TEXT ONLY
    if (!fileBuffer || !mimeType) {
      response =
        await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

      return (
        response.text ??
        "No explanation generated."
      );
    }

    // IMAGE OR PDF
    const base64 =
      fileBuffer.toString("base64");

    response =
      await ai.models.generateContent({
        model: "gemini-2.5-flash",

        contents: [
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
          {
            text: prompt,
          },
        ],
      });

    return (
      response.text ??
      "No explanation generated."
    );
  } catch (error) {
    console.error(
      "Gemini Error:",
      error
    );

    throw new Error(
      "Failed to generate explanation"
    );
  }
}
