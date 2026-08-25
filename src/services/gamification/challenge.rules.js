import { db } from "../../../lib/db.js";

import {
  completeChallenge,
  getChallengeByCode,
} from "./challenge.service.js";

import {
  awardAccountXP,
} from "./level.service.js";

import {
  checkGeneralAchievements,
} from "./achievement.rules.js";

import {
  DAILY_CHALLENGE_CODES,
} from "./constants.js";

/**
 * Completes a daily challenge,
 * awards its XP reward,
 * and checks for new achievements.
 */
async function completeDailyChallenge({
  studentId,
  title,
  tx = db,
}) {
  const challenge =
    await getChallengeByCode({
      title,
      tx,
    });

  if (!challenge) {
    return null;
  }

  const alreadyCompleted =
    await tx.dailyChallengeProgress.findFirst({
      where: {
        studentId,
        challengeId: challenge.id,
        completed: true,
      },
    });

  if (alreadyCompleted) {
    return alreadyCompleted;
  }

  const progress =
    await completeChallenge({
      studentId,
      challengeId: challenge.id,
      tx,
    });

  await awardAccountXP({
    studentId,
    xp: challenge.xpReward,
    tx,
  });

  await checkGeneralAchievements({
    studentId,
    tx,
  });

  return progress;
}

/**
 * Triggered after a Millionaire game.
 */

export async function checkMillionaireChallenges({
  studentId,
  tx = db,
}) {
  return await completeDailyChallenge({
    studentId,
    title:
      DAILY_CHALLENGE_CODES.COMPLETE_ONE_MILLIONAIRE_GAME,
    tx,
  });
}


/**
 * Triggered after a Speed Challenge.
 */
export async function checkSpeedChallengeChallenges({
  studentId,
  tx = db,
}) {
  return await completeDailyChallenge({
    studentId,
    title:
      DAILY_CHALLENGE_CODES.COMPLETE_ONE_SPEED_CHALLENGE,
    tx,
  });
}