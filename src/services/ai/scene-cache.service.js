import { GoogleGenAI } from "@google/genai";
import {
  buildSceneGenerationInstructions,
} from "./scene-generation-instructions.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-2.5-flash";

export async function createSceneGenerationCache({
  subject,
  topic,
  classLevel,
  lessonContents,
  lessonPlan,
}) {
  const instructions =
    buildSceneGenerationInstructions();

  const lessonContext = `
LESSON CONTEXT

Subject:
${subject}

Topic:
${topic}

Class Level:
${classLevel}

Lesson Contents:
${JSON.stringify(
  lessonContents,
  null,
  2
)}

Lesson Plan:
${JSON.stringify(
  lessonPlan,
  null,
  2
)}
`;

  const cache = await ai.caches.create({
    model: MODEL,

    config: {
      displayName:
        `scene-generation-${subject}-${topic}`,

      systemInstruction:
        instructions,

      contents: [
        {
          role: "user",

          parts: [
            {
              text: lessonContext,
            },
          ],
        },
      ],

      ttl: "3600s",
    },
  });

  return cache;
}