import { updateSubjectRanking } from "./ranking.service.js";
import { XP } from "./constants.js";

/**
 * Awards XP to a student for a subject.
 *
 * @param {Object} params
 * @param {string} params.studentId
 * @param {string} params.subjectId
 * @param {number} params.xp
 * @param {string} [params.source]
 */
export async function awardXP({
  studentId,
  subjectId,
  classId,
  xp,
  source,
  tx
}) {
  if (!studentId) {
    throw new Error("studentId is required.");
  }

  if (!subjectId) {
    throw new Error("subjectId is required.");
  }

  if (typeof xp !== "number" || xp <= 0) {
    throw new Error("xp must be greater than zero.");
  }

  const ranking = await updateSubjectRanking({
    studentId,
    subjectId,
    classId,
    xp,
    tx
  });

  return {
    source,
    awardedXP: xp,
    currentXP: ranking.xp,
    currentLevel: ranking.level,
    ranking,
  };
}

/**
 * Millionaire XP calculation
 */
export function calculateMillionaireXP({
  correct,
  levelReached,
  completed,
}) {
  let xp = XP.MILLIONAIRE.PARTICIPATION;

  xp += correct * XP.MILLIONAIRE.PER_CORRECT;

  xp += levelReached * XP.MILLIONAIRE.LEVEL_REACHED;

  if (completed) {
    xp += XP.MILLIONAIRE.COMPLETION_BONUS;
  }

  return xp;
}

/**
 * Speed Challenge XP calculation
 */
export function calculateSpeedChallengeXP({
  correct,
  accuracy,
}) {
  let xp = XP.SPEED_CHALLENGE.PARTICIPATION;

  xp += correct * XP.SPEED_CHALLENGE.PER_CORRECT;

  if (accuracy >= 100) {
    xp += XP.SPEED_CHALLENGE.ACCURACY_100;
  } else if (accuracy >= 90) {
    xp += XP.SPEED_CHALLENGE.ACCURACY_90;
  }

  return xp;
}

