import { db } from "../../../lib/db.js";

import {
  calculateMillionaireXP,
  calculateSpeedChallengeXP,
  awardXP,
} from "./xp.service.js";

import {
  awardAccountXP,
  updateStudentProfile,
} from "./level.service.js";

import {
  checkMillionaireAchievements,
  checkSpeedChallengeAchievements,
} from "./achievement.rules.js";

import {
  checkMillionaireChallenges,
  checkSpeedChallengeChallenges,
} from "./challenge.rules.js";

import {
  recordGame,
} from "./studentProfile.service.js";

/**
 * Handles all gamification logic for the
 * Millionaire Challenge.
 */
export async function processMillionaireGame({
  studentId,
  subjectId,
  classId,
  score,
  levelReached,
  correct,
  wrong,
  completed,
}) {
  return await db.$transaction(async (tx) => {
    // 1. Calculate XP
    const xp =
      calculateMillionaireXP({
        correct,
        levelReached,
        completed,
      });

    // 2. Award subject XP
    console.time("millionaire:awardXP");
    const ranking =
      await awardXP({
        studentId,
        subjectId,
        classId,
        xp,
        source: "MILLIONAIRE",
        tx,
      });
    console.timeEnd("millionaire:awardXP");

    // 3. Award overall account XP
    console.time("millionaire:awardAccountXP");
    const profile =
      await awardAccountXP({
        studentId,
        xp,
        tx,
      });
    console.timeEnd("millionaire:awardAccountXP");
    
    // 4. Update profile statistics
    console.time("millionaire:updateStudentProfile");
    await updateStudentProfile({
      studentId,
      totalGames: 1,
      totalWins: completed ? 1 : 0,
      streak: completed ? previousStreak + 1 : 0,
      tx,
    });
    console.timeEnd("millionaire:updateStudentProfile");

    // 5. Unlock achievements
    console.time("checkMillionaireAchievements");
    const achievements =
      await checkMillionaireAchievements({
        studentId,
        levelReached,
        score,
        completed,
        tx,
      });
    console.timeEnd("checkMillionaireAchievements");

    // 6. Daily Challenges
    console.time("checkMillionaireChallenges");
    await checkMillionaireChallenges({
      studentId,
      subjectId,
      tx,
    });
    console.timeEnd("checkMillionaireChallenges");

    console.time("millionaire:recordGame");
    await recordGame({
      studentId,
      won: completed,
      streak: completed,
      tx,
    });
    console.timeEnd("millionaire:recordGame");

    return {
      xpAwarded: xp,
      ranking,
      profile,
      achievements,
    };
  });
}

/**
 * Handles all gamification logic for the
 * Speed Challenge.
 */
export async function processSpeedChallengeGame({
  studentId,
  subjectId,
  classId,
  score,
  correct,
  wrong,
  accuracy,
  difficulty,
}) {
  return await db.$transaction(async (tx) => {
    // 1. Calculate XP
    const xp =
      calculateSpeedChallengeXP({
        correct,
        accuracy,
      });

    // 2. Award subject XP
    console.time("speed:awardXP");
    const ranking =
      await awardXP({
        studentId,
        subjectId,
        classId,
        xp,
        source: "SPEED_CHALLENGE",
        tx,
      });
    console.timeEnd("speed:awardXP");

    // 3. Award account XP
    console.time("speed:awardAccountXP");
    const profile =
      await awardAccountXP({
        studentId,
        xp,
        tx,
      });
    console.timeEnd("speed:awardAccountXP");

    // 4. Update profile statistics
    console.time("speed:updateStudentProfile");
    await updateStudentProfile({
      studentId,
      totalGames: 1,
      tx,
    });
    console.timeEnd("speed:updateStudentProfile");

    // 5. Unlock achievements
    console.time("achievements");
    const achievements =
      await checkSpeedChallengeAchievements({
        studentId,
        accuracy,
        score,
        tx,
      });
    console.timeEnd("achievements");

    // 6. Daily Challenges
    console.time("dailyChallenge");
    await checkSpeedChallengeChallenges({
      studentId,
      subjectId,
      accuracy,
      tx,
    });
    console.timeEnd("dailyChallenge");

    console.time("speed:recordGame");
    await recordGame({
      studentId,
      won: accuracy >= 90,
      streak: true,
      tx,
    });
    console.timeEnd("speed:recordGame");

    return {
      xpAwarded: xp,
      ranking,
      profile,
      achievements,
    };
  });
}