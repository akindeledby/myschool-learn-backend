import { db } from "../../../lib/db.js";
import { ai } from "../../../lib/gemini.js";

export async function generateConversationSummary(
  conversationId,
  studentId
) {
  const messages = await db.tutorMessage.findMany({
    where: {
      conversationId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (messages.length < 6) {
    return;
  }

  const transcript = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n");

  const response =
    await ai.models.generateContent({
      model: "gemini-2.5-flash",

      contents: `
    Summarize this tutoring session.

    Focus on:

    - topics learned
    - concepts mastered
    - concepts struggling with
    - next learning goals

    Conversation:

    ${transcript}
    `,
    });

  const summary = response.text;

  await db.tutorSessionSummary.upsert({
    where: {
      conversationId,
    },

    update: {
      summary,
    },

    create: {
      conversationId,
      studentId,
      summary,
    },
  });
}