import { db } from "../../../lib/db.js";

/**
 * Returns all active daily challenges.
 */
export async function getDailyChallenges({
  tx = db,
}) {
  return await tx.dailyChallenge.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Returns a student's progress
 * for all daily challenges.
 */
export async function getStudentChallengeProgress({
  studentId,
  tx = db,
}) {
  return await tx.dailyChallengeProgress.findMany({
    where: {
      studentId,
    },

    include: {
      challenge: true,
    },
  });
}

/**
 * Checks whether a student has already
 * completed a challenge.
 */
export async function hasCompletedChallenge({
  studentId,
  challengeId,
  tx = db,
}) {
  const progress =
    await tx.dailyChallengeProgress.findFirst({
      where: {
        studentId,
        challengeId,
        completed: true,
      },
    });

  return !!progress;
}

/**
 * Marks a challenge as completed.
 * If a progress record doesn't exist,
 * it is created.
 */
export async function completeChallenge({
  studentId,
  challengeId,
  tx = db,
}) {
  const existing =
    await tx.dailyChallengeProgress.findFirst({
      where: {
        studentId,
        challengeId,
      },
    });

  if (existing) {
    if (existing.completed) {
      return existing;
    }

    return await tx.dailyChallengeProgress.update({
      where: {
        id: existing.id,
      },

      data: {
        completed: true,
      },
    });
  }

  return await tx.dailyChallengeProgress.create({
    data: {
      studentId,
      challengeId,
      completed: true,
    },
  });
}

/**
 * Returns a single challenge.
 */
export async function getChallengeByCode({
  title,
  tx = db,
}) {
  return await tx.dailyChallenge.findUnique({
    where: {
      title,
    },
  });
}

/**
 * Completes a challenge using its title.
 */
export async function completeChallengeByTitle({
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

  return await completeChallenge({
    studentId,
    challengeId: challenge.id,
    tx,
  });
}

/**
 * Returns all challenge progress
 * for a student.
 */
export async function getStudentDailyChallenges({
  studentId,
  tx = db,
}) {
  if (!studentId) {
    throw new Error(
      "studentId is required."
    );
  }

  return await tx.dailyChallengeProgress.findMany({
    where: {
      studentId,
    },
  });
}

/**
 * Returns all daily challenges
 * together with the student's progress.
 */
export async function getStudentChallenges({
  studentId,
  tx = db,
}) {
  const [
    challenges,
    progress,
  ] = await Promise.all([
    getDailyChallenges({
      tx,
    }),

    getStudentDailyChallenges({
      studentId,
      tx,
    }),
  ]);

  const progressMap =
    new Map(
      progress.map((item) => [
        item.challengeId,
        item.completed,
      ])
    );

  return challenges.map(
    (challenge) => ({
      ...challenge,
      completed:
        progressMap.get(
          challenge.id
        ) || false,
    })
  );
}