import { db } from "../../../lib/db.js";

/**
 * Unlocks a single achievement.
 */
export async function unlockAchievement({
  studentId,
  code,
  tx = db,
}) {
  if (!studentId) {
    throw new Error(
      "studentId is required."
    );
  }

  if (!code) {
    throw new Error(
      "Achievement code is required."
    );
  }

  const definition =
    await tx.achievementDefinition.findUnique({
      where: {
        code,
      },
    });

  if (!definition) {
    throw new Error(
      `Achievement '${code}' does not exist.`
    );
  }

  const existing =
    await tx.studentAchievement.findFirst({
      where: {
        studentId,
        achievementId: definition.id,
      },
    });

  if (existing) {
    return existing;
  }

  return await tx.studentAchievement.create({
    data: {
      studentId,
      achievementId: definition.id,
      earnedAt: new Date(),
    },
  });
}

/**
 * Unlocks multiple achievements.
 */
export async function unlockAchievements({
  studentId,
  codes = [],
  tx = db,
}) {
  if (!codes.length) {
    return [];
  }

  const unlocked = [];

  for (const code of codes) {
    const achievement =
      await unlockAchievement({
        studentId,
        code,
        tx,
      });

    unlocked.push(
      achievement
    );
  }

  return unlocked;
}

/**
 * Checks if a student already has an achievement.
 */
export async function hasAchievement({
  studentId,
  code,
  tx = db,
}) {
  const definition =
    await tx.achievementDefinition.findUnique({
      where: {
        code,
      },
    });

  if (!definition) {
    return false;
  }

  const achievement =
    await tx.studentAchievement.findFirst({
      where: {
        studentId,
        achievementId:
          definition.id,
      },
    });

  return !!achievement;
}

/**
 * Returns all achievements earned by a student.
 */
export async function getStudentAchievements({
  studentId,
  tx = db,
}) {
  return await tx.studentAchievement.findMany({
    where: {
      studentId,
    },

    include: {
      achievement: true,
    },

    orderBy: {
      earnedAt: "desc",
    },
  });
}

/**
 * Returns the total number of achievements
 * earned by a student.
 */
export async function getAchievementCount({
  studentId,
  tx = db,
}) {
  return await tx.studentAchievement.count({
    where: {
      studentId,
    },
  });
}


export async function getAchievementsForStudent({
    studentId,
}) {
    const definitions =
        await db.achievementDefinition.findMany({
            // orderBy: {
            //     title: "asc",
            // },
        });

    const earned =
        await db.studentAchievement.findMany({
            where: {
                studentId,
            },
        });

    const unlocked =
        new Map(
            earned.map((item) => [
                item.achievementId,
                item,
            ])
        );

    return definitions.map((definition) => {
        const achievement =
            unlocked.get(definition.id);

        return {
            ...definition,
            unlocked: !!achievement,
            earnedAt:
                achievement?.earnedAt || null,
        };
    });
}
