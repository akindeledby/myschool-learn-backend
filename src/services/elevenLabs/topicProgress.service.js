import { db } from "../../../lib/db.js";
import { ai } from "../../../lib/gemini.js";
import { TopicSchema } from "./schemas/topic.schema.js";
import { parseGeminiJson } from "../../utils/parseGeminiJson.js";

export async function updateTopicProgress({
  conversationId,
  studentId,
  topicId,
  lessonProgressId,
  lessonSessionId,
}) {
  try {
    if (!conversationId || !studentId) {
      console.warn(
        "[updateTopicProgress] Missing conversationId or studentId."
      );

      return null;
    }

    const messages =
      await db.tutorMessage.findMany({
        where: {
          conversationId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

    if (!messages.length) {
      return null;
    }

    const transcript = messages
      .map(
        (message) =>
          `${message.role}: ${message.content}`
      )
      .join("\n");

    const response =
      await ai.models.generateContent({
        model: "gemini-2.5-flash",

        contents: `
Analyze this tutoring conversation.

Return ONLY valid JSON.

Schema:

{
  "topic": "",
  "subject": "",
  "masteryScore": 0,
  "strengths": [],
  "weaknesses": []
}

Conversation:

${transcript}
        `,
      });

    const parsed =
      TopicSchema.parse(
        parseGeminiJson(response.text)
      );

    return await db.tutorTopicProgress.upsert({
      where: {
        studentId_topic: {
          studentId,
          topic: parsed.topic,
        },
      },

      update: {
        subject: parsed.subject,
        masteryScore:
          parsed.masteryScore,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
        lastStudiedAt: new Date(),
      },

      create: {
        studentId,
        subject: parsed.subject,
        topic: parsed.topic,
        masteryScore:
          parsed.masteryScore,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
        lastStudiedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(
      "Topic progress error:",
      error
    );

    return null;
  }
}
