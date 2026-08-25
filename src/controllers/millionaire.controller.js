import { db } from "../../lib/db.js";
import { resolveStudent } from "../services/elevenLabs/studentResolver.service.js";
import { processMillionaireGame } from "../../src/services/gamification/gamification.service.js";
import { checkSubscriptionAccess } from "../services/subscription/subscription.access.js";
import { SUBSCRIPTION_FEATURES } from "../services/subscription/subscription.constants.js";

import { buildMillionairePrompt } from "../services/millionaireAskAi/millionaire.prompt.js";
import { generateMillionaireHint } from "../services/millionaireAskAi/askAi.service.js";

export async function saveMillionaireAttempt(req, res) {
  try {
    const userId = req.user.userId;
    
    const {
      studentId,
      subjectId,
      score,
      levelReached,
      correct,
      wrong,
      completed,
    } = req.body;

    // 1. Resolve student
    const student = await resolveStudent({
      userId,
      studentId,
    });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

     /*
      ==========================================
       Check Subscription Access
      ==========================================
    */
    
    const access =
      await checkSubscriptionAccess({
        userId,
        feature:
          SUBSCRIPTION_FEATURES.MILLIONAIRE,
      });
    
    if (!access.success) {
      return res.status(403).json(access);
    }

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message:
          "Subject is required",
      });
    }

    const attempt =
      await db.millionaireAttempt.create({
        data: {
          studentId: student.id,
          subjectId,
          score,
          levelReached,
          correct,
          wrong,
          completed,
        },
      });

    await processMillionaireGame({
      studentId: student.id,
      subjectId,
      score,
      levelReached,
      classId: student.classId,
      correct,
      wrong,
      completed,
    });

    return res.status(201).json({
      success: true,
      attempt,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to save attempt",
    });
  }
}


export async function getMyMillionaireStats(
  req,
  res
) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;

    // 1. Resolve student
    const student = await resolveStudent({
      userId,
      studentId,
    });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    } 

         /*
      ==========================================
       Check Subscription Access
      ==========================================
    */
    
    const access =
      await checkSubscriptionAccess({
        userId,
        feature:
          SUBSCRIPTION_FEATURES.MILLIONAIRE,
      });
    
    if (!access.success) {
      return res.status(403).json(access);
    }

    const attempts =
      await db.millionaireAttempt.findMany({
        where: {
          studentId:
            student.id,
        },
      });

    const totalGames =
      attempts.length;

    const highestScore =
      Math.max(
        0,
        ...attempts.map(
          (a) => a.score
        )
      );

    const totalCorrect =
      attempts.reduce(
        (sum, item) =>
          sum + item.correct,
        0
      );

    const totalWrong =
      attempts.reduce(
        (sum, item) =>
          sum + item.wrong,
        0
      );

    return res.status(200).json({
      success: true,

      stats: {
        totalGames,
        highestScore,
        totalCorrect,
        totalWrong,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to load stats",
    });
  }
}


export async function askAI(req, res) {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        message: "Question is required.",
      });
    }

    const prompt = buildMillionairePrompt(question);

    const result = await generateMillionaireHint(prompt);

    return res.status(200).json({
      success: true,
      answer: result.answer,
      confidence: result.confidence,
      explanation: result.explanation,
    });
  } catch (error) {
    console.error("Ask AI Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to generate AI suggestion.",
    });
  }
}