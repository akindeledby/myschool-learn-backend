import { db } from "../../../lib/db.js";

/**
 * Returns the student's profile.
 * Returns null if it does not exist.
 */
export async function getStudentProfile({
  studentId,
  tx = db,
}) {
  if (!studentId) {
    throw new Error(
      "studentId is required."
    );
  }

  return await tx.studentProfile.findUnique({
    where: {
      studentId,
    },
  });
}

/**
 * Returns the student's profile.
 * Creates one if it does not exist.
 */
export async function getOrCreateStudentProfile({
  studentId,
  tx = db,
}) {
  if (!studentId) {
    throw new Error(
      "studentId is required."
    );
  }

  let profile =
    await getStudentProfile({
      studentId,
      tx,
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
 * Adds to the total games played.
 */
export async function incrementGamesPlayed({
  studentId,
  amount = 1,
  tx = db,
}) {
  const profile =
    await getOrCreateStudentProfile({
      studentId,
      tx,
    });

  return await tx.studentProfile.update({
    where: {
      id: profile.id,
    },

    data: {
      totalGames: {
        increment: amount,
      },
    },
  });
}

/**
 * Adds to the student's wins.
 */
export async function incrementWins({
  studentId,
  amount = 1,
  tx = db,
}) {
  const profile =
    await getOrCreateStudentProfile({
      studentId,
      tx,
    });

  return await tx.studentProfile.update({
    where: {
      id: profile.id,
    },

    data: {
      totalWins: {
        increment: amount,
      },
    },
  });
}

/**
 * Updates the student's streak.
 */
export async function updateStreak({
  studentId,
  amount = 1,
  tx = db,
}) {
  const profile =
    await getOrCreateStudentProfile({
      studentId,
      tx,
    });

  return await tx.studentProfile.update({
    where: {
      id: profile.id,
    },

    data: {
      streak: {
        increment: amount,
      },
    },
  });
}

/**
 * Resets the student's streak.
 */
export async function resetStreak({
  studentId,
  tx = db,
}) {
  const profile =
    await getOrCreateStudentProfile({
      studentId,
      tx,
    });

  return await tx.studentProfile.update({
    where: {
      id: profile.id,
    },

    data: {
      streak: 0,
    },
  });
}

/**
 * Records the result of a completed game.
 */
export async function recordGame({
  studentId,
  won = false,
  streak = true,
  tx = db,
}) {
  await incrementGamesPlayed({
    studentId,
    tx,
  });

  if (won) {
    await incrementWins({
      studentId,
      tx,
    });
  }

  if (streak) {
    await updateStreak({
      studentId,
      tx,
    });
  } else {
    await resetStreak({
      studentId,
      tx,
    });
  }

  return await getStudentProfile({
    studentId,
    tx,
  });
}