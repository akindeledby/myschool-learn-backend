import { GoogleGenAI } from "@google/genai";
import { buildLessonPlanningContext } from "./scene-planner.service.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-2.5-flash";

export async function createLessonPlanningCache({
  subject,
  classLevel,
  topic,
  lessonContents,
  targetSeconds = 90,
  targetMinutes = 30,
}) {
  const {
    instructions,
    lessonContext,
  } = buildLessonPlanningContext({
    subject,
    topic,
    lessonContents,
    classLevel,
    targetSeconds,
    targetMinutes,
  });

  const cache = await ai.caches.create({
    model: MODEL,

    config: {
      displayName:
        `lesson-planning-${subject}-${topic}`,

      systemInstruction: instructions,

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

  console.log(
    `✅ Lesson planning cache created: ${cache.name}`
  );

  return cache;
}