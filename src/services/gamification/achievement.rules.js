import { db } from "../../../lib/db.js";

import {
  unlockAchievements,
} from "./achievement.service.js";

import {
  ACHIEVEMENT_CODES,
} from "./constants.js";

/**
 * Checks achievements earned from
 * Millionaire Challenge.
 */
export async function checkMillionaireAchievements({
  studentId,
  levelReached,
  score,
  completed,
  tx = db,
}) {
  const codes = [];

  // First completed game
  const gamesPlayed =
    await tx.millionaireAttempt.count({
      where: {
        studentId,
      },
    });

  if (gamesPlayed === 1) {
    codes.push(
      ACHIEVEMENT_CODES.FIRST_VICTORY
    );
  }

  if (levelReached >= 5) {
    codes.push(
      ACHIEVEMENT_CODES.LEVEL5_SURVIVOR
    );
  }

  if (levelReached >= 10) {
    codes.push(
      ACHIEVEMENT_CODES.LEVEL10_MASTER
    );
  }

  if (score >= 100000) {
    codes.push(
      ACHIEVEMENT_CODES.HIGH_ROLLER
    );
  }

  if (completed) {
    codes.push(
      ACHIEVEMENT_CODES.MILLIONAIRE_CHAMPION
    );
  }

  return await unlockAchievements({
    studentId,
    codes,
    tx,
  });
}

/**
 * Checks achievements earned from
 * Speed Challenge.
 */
export async function checkSpeedChallengeAchievements({
  studentId,
  accuracy,
  score,
  tx = db,
}) {
  const codes = [];

  if (accuracy >= 95) {
    codes.push(
      ACHIEVEMENT_CODES.SPEED_DEMON
    );
  }

  return await unlockAchievements({
    studentId,
    codes,
    tx,
  });
}

/**
 * Unlocks Question Master after
 * answering 100 questions correctly.
 */
export async function checkQuestionMasterAchievement({
  studentId,
  tx = db,
}) {
  const millionaire =
    await tx.millionaireAttempt.aggregate({
      where: {
        studentId,
      },

      _sum: {
        correct: true,
      },
    });

  const speed =
    await tx.speedChallengeAttempt.aggregate({
      where: {
        studentId,
      },

      _sum: {
        correct: true,
      },
    });

  const totalCorrect =
    (millionaire._sum.correct || 0) +
    (speed._sum.correct || 0);

  if (totalCorrect < 100) {
    return [];
  }

  return await unlockAchievements({
    studentId,
    codes: [
      ACHIEVEMENT_CODES.QUESTION_MASTER,
    ],
    tx,
  });
}

/**
 * Unlocks Level 10 Scholar.
 */
export async function checkLevelScholarAchievement({
  studentId,
  tx = db,
}) {
  const profile =
    await tx.studentProfile.findUnique({
      where: {
        studentId,
      },
    });

  if (!profile) {
    return [];
  }

  if (profile.level < 10) {
    return [];
  }

  return await unlockAchievements({
    studentId,
    codes: [
      ACHIEVEMENT_CODES.LEVEL10_SCHOLAR,
    ],
    tx,
  });
}

/**
 * Unlocks 7 Day Streak.
 */
export async function checkStreakAchievement({
  studentId,
  tx = db,
}) {
  const profile =
    await tx.studentProfile.findUnique({
      where: {
        studentId,
      },
    });

  if (!profile) {
    return [];
  }

  if (profile.streak < 7) {
    return [];
  }

  return await unlockAchievements({
    studentId,
    codes: [
      ACHIEVEMENT_CODES.SEVEN_DAY_STREAK,
    ],
    tx,
  });
}

/**
 * Runs every achievement rule.
 *
 * Useful after any activity that
 * changes XP or profile progress.
 */
export async function checkGeneralAchievements({
  studentId,
  tx = db,
}) {
  await Promise.all([
    checkQuestionMasterAchievement({
      studentId,
      tx,
    }),

    checkLevelScholarAchievement({
      studentId,
      tx,
    }),

    checkStreakAchievement({
      studentId,
      tx,
    }),
  ]);
}