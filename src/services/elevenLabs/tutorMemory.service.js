import { db } from "../../../lib/db.js";
import { ai } from "../../../lib/gemini.js";
import { MemorySchema } from "./schemas/memory.schema.js";
import { parseGeminiJson } from "../../utils/parseGeminiJson.js";

export async function updateTutorMemory(
  conversationId,
  studentId
) {
  const messages =
    await db.tutorMessage.findMany({
      where: {
        conversationId,
      },
    });

  if (!messages.length) {
    return;
  }

  const transcript = messages
    .map(
      (m) =>
        `${m.role}: ${m.content}`
    )
    .join("\n");

  const response =
    await ai.models.generateContent({
      model: "gemini-2.5-flash",

      contents: `
      You are building long-term memory for an AI Tutor.

      Extract ONLY information useful for future tutoring.

      Return ONLY JSON.

      {
        "memories":[
          {
            "key":"",
            "value":"",
            "category":"",
            "importance":1
          }
        ]
      }

      Conversation:

      ${transcript}
      `,
    });

  const parsed = MemorySchema.parse(
    parseGeminiJson(response.text)
  );

  for (const memory of parsed.memories) {
    await db.tutorMemory.upsert({
      where: {
        studentId_key: {
          studentId,
          key: memory.key,
        },
      },

      update: {
        value: memory.value,
        category:
          memory.category,
        importance:
          memory.importance,
      },

      create: {
        studentId,
        key: memory.key,
        value: memory.value,
        category:
          memory.category,
        importance:
          memory.importance,
      },
    });
  }
}