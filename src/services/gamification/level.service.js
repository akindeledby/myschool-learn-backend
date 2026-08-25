import { db } from "../../../lib/db.js";
import { ACCOUNT_LEVEL_XP } from "./constants.js";
import { calculateLevel } from "./helpers.js";

/**
 * Calculates the student's overall account level.
 */
export function calculateAccountLevel(xp) {
  return calculateLevel(
    xp,
    ACCOUNT_LEVEL_XP
  );
}

/**
 * Returns the student's profile.
 * Creates one if it doesn't exist.
 */

export async function getOrCreateStudentProfile(
  studentId,
  tx = db
) {
  let profile =
    await tx.studentProfile.findUnique({
      where: {
        studentId,
      },
    });

  if (!profile) {
    profile =
      await tx.studentProfile.create({
        data: {
          studentId,
        },
      });
  }

  return profile;
}

/**
 * Awards overall account XP.
 */
export async function awardAccountXP({
  studentId,
  xp,
  tx = db,
}) {
  if (!studentId) {
    throw new Error(
      "studentId is required."
    );
  }

  if (xp <= 0) {
    throw new Error(
      "XP must be greater than zero."
    );
  }

  const profile =
    await getOrCreateStudentProfile(
      studentId,
      tx
    );

  const newXP =
    profile.xp + xp;

  const newLevel =
    calculateAccountLevel(
      newXP
    );

  return await tx.studentProfile.update({
    where: {
      id: profile.id,
    },
    data: {
      xp: newXP,
      level: newLevel,
    },
  });
}

/**
 * Updates student profile statistics.
 */
export async function updateStudentProfile({
  studentId,
  totalGames = 0,
  totalWins = 0,
  streak,
  tx = db,
}) {
  const profile =
    await getOrCreateStudentProfile(
      studentId,
      tx
    );

  const data = {
    totalGames: {
      increment: totalGames,
    },

    totalWins: {
      increment: totalWins,
    },
  };

  if (
    typeof streak ===
    "number"
  ) {
    data.streak = streak;
  }

  return await tx.studentProfile.update({
    where: {
      id: profile.id,
    },
    data,
  });
}

/**
 * Returns the student's profile.
 */
export async function getStudentProfile(
  studentId
) {
  return await getOrCreateStudentProfile(
    studentId
  );
}