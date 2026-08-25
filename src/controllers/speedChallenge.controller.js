import { db } from "../../lib/db.js";
import { resolveStudent } from "../services/elevenLabs/studentResolver.service.js";
import { processSpeedChallengeGame } from "../../src/services/gamification/gamification.service.js";
import { checkSubscriptionAccess } from "../services/subscription/subscription.access.js";
import { SUBSCRIPTION_FEATURES } from "../services/subscription/subscription.constants.js";

export async function submitSpeedChallenge(req, res) {
  try {
    const userId = req.user.userId;

    const {
      studentId,
      subjectId,
      score,
      correct,
      wrong,
      timeSpentSeconds,
      difficulty,
    } = req.body;


    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message: "Subject is required",
      });
    }

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

    const access =
      await checkSubscriptionAccess({
        userId,
        feature:
          SUBSCRIPTION_FEATURES.SPEED_CHALLENGE,
      });

    if (!access.success) {
      return res.status(403).json(access);
    }

    const accuracy =
      correct + wrong > 0
        ? Math.round(
            (correct / (correct + wrong)) * 100
          )
        : 0;

    const attempt =
      await db.speedChallengeAttempt.create({
        data: {
          studentId: student.id,
          subjectId,
          score,
          correct,
          wrong,
          timeSpent: timeSpentSeconds,
          accuracy,
          difficulty,
          completed: true,
        },
      });

    const rewards =
      await processSpeedChallengeGame({
        studentId: student.id,
        subjectId,
        classId: student.classId,
        score,
        correct,
        wrong,
        accuracy,
        difficulty,
      });

    return res.status(201).json({
      success: true,
      attempt,
      rewards,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to save speed challenge",
    });
  }
}

export async function getMySpeedChallengeStats(req, res) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;

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

    const access =
      await checkSubscriptionAccess({
        userId,
        feature:
          SUBSCRIPTION_FEATURES.SPEED_CHALLENGE,
      });

    if (!access.success) {
      return res.status(403).json(access);
    }

    const attempts = await db.speedChallengeAttempt.findMany({
      where: {
        studentId: student.id,
      },
    });

    const totalGames = attempts.length;

    const highestScore = Math.max(
      0,
      ...attempts.map((a) => a.score)
    );

    const totalCorrect = attempts.reduce(
      (sum, item) => sum + item.correct,
      0
    );

    const totalWrong = attempts.reduce(
      (sum, item) => sum + item.wrong,
      0
    );

    const averageAccuracy =
      attempts.length > 0
        ? Math.round(
            attempts.reduce(
              (sum, a) => sum + (a.accuracy || 0),
              0
            ) / attempts.length
          )
        : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalGames,
        highestScore,
        totalCorrect,
        totalWrong,
        averageAccuracy,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to load speed challenge stats",
    });
  }
}