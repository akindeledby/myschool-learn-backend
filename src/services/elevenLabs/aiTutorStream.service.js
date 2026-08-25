import { ai } from "../../../lib/gemini.js";

export async function streamTutorResponse({
  systemPrompt,
  message,
  previousMessages = [],
}) {
  const stream =
    await ai.models.generateContentStream({
      model: "gemini-2.5-flash",

      config: {
        systemInstruction: systemPrompt,
      },

      contents: [
        ...previousMessages,
        {
          role: "user",
          parts: [
            {
              text: message,
            },
          ],
        },
      ],
    });

  return stream;
}
