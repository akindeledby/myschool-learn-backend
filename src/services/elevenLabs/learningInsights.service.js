// services/elevenLabs/learningInsights.service.js

import { db } from "../../../lib/db.js";
import { ai } from "../../../lib/gemini.js";
import { InsightSchema } from "./schemas/insight.schema.js";
import { parseGeminiJson } from "../../utils/parseGeminiJson.js";


export async function generateLearningInsights(
  studentId
) {
  try {
    const progress =
      await db.tutorTopicProgress.findMany({
        where: {
          studentId,
        },
      });

    if (!progress.length) {
      return null;
    }

    const history = progress
      .map(
        (p) => `
          Subject: ${p.subject}
          Topic: ${p.topic}
          Mastery: ${p.masteryScore}
          Strengths: ${p.strengths.join(", ")}
          Weaknesses: ${p.weaknesses.join(", ")}
          `
      )
      .join("\n");

    const response =
      await ai.models.generateContent({
        model: "gemini-2.5-flash",

        contents: `
        Analyze this student's learning history.

        Return ONLY JSON.

        {
          "strongestSubject":"",
          "weakestSubject":"",
          "recommendedTopics":[],
          "nextGoal":""
        }

        ${history}
        `,
      });

    // const parsed =
    //   InsightSchema.parse(
    //     JSON.parse(response.text)
    //   );
    const parsed = InsightSchema.parse(
      parseGeminiJson(response.text)
    );

    return await db.tutorLearningInsight.upsert({
      where: {
        studentId,
      },

      update: {
        strongestSubject:
          parsed.strongestSubject,
        weakestSubject:
          parsed.weakestSubject,
        recommendedTopics:
          parsed.recommendedTopics,
        nextGoal:
          parsed.nextGoal,
      },

      create: {
        studentId,
        strongestSubject:
          parsed.strongestSubject,
        weakestSubject:
          parsed.weakestSubject,
        recommendedTopics:
          parsed.recommendedTopics,
        nextGoal:
          parsed.nextGoal,
      },
    });
  } catch (error) {
    console.error(
      "Learning insight error:",
      error
    );

    return null;
  }
}
