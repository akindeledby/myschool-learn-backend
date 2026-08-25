import { db } from "../../../lib/db.js";
import { ai } from "../../../lib/gemini.js";
import { parseGeminiJson } from "../../utils/parseGeminiJson.js";


export async function updateLearningProfile(
  conversationId,
  studentId
) {
  try {
    const messages =
      await db.tutorMessage.findMany({
        where: {
          conversationId,
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    if (messages.length < 10) {
      return null;
    }

    const transcript =
      messages
        .map(
          (msg) =>
            `${msg.role}: ${msg.content}`
        )
        .join("\n");

    const response =
      await ai.models.generateContent({
        model: "gemini-2.5-flash",

        config: {
          responseMimeType:
            "application/json",
        },

        contents: `
        Analyze this tutoring conversation.

        Determine:

        1. preferredExplanationStyle
        (one of: "step-by-step", "examples", "visual", "concise", "detailed")

        2. preferredDifficulty
        (one of: "beginner", "intermediate", "advanced")

        3. learningSpeed
        (one of: "slow", "moderate", "fast")

        Return ONLY valid JSON.

        Example:

        {
          "preferredExplanationStyle": "step-by-step",
          "preferredDifficulty": "intermediate",
          "learningSpeed": "moderate"
        }

        Conversation:

        ${transcript}
        `,
      });

    let object;

    try {
      object = parseGeminiJson(response.text);
    } catch (error) {
      console.error(
        "Failed to parse learning profile JSON:",
        response.text
      );

      return null;
    }

    const result =
      await db.tutorLearningProfile.upsert({
        where: {
          studentId,
        },

        update: {
          preferredExplanationStyle:
            object.preferredExplanationStyle,

          preferredDifficulty:
            object.preferredDifficulty,

          learningSpeed:
            object.learningSpeed,
        },

        create: {
          studentId,

          preferredExplanationStyle:
            object.preferredExplanationStyle,

          preferredDifficulty:
            object.preferredDifficulty,

          learningSpeed:
            object.learningSpeed,
        },
      });

    return result;

  } catch (error) {
    console.error(
      "Learning profile error:",
      error
    );

    return null;
  }
}
