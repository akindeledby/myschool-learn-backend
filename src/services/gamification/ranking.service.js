import { db } from "../../../lib/db.js";
import { SUBJECT_LEVEL_XP } from "./constants.js";

/**
 * Calculates subject level from XP.
 *
 * Level 1 = 0 XP
 * Level 2 = SUBJECT_LEVEL_XP
 * Level 3 = SUBJECT_LEVEL_XP * 2
 */
export function calculateSubjectLevel(xp) {
  return Math.max(
    1,
    Math.floor(xp / SUBJECT_LEVEL_XP) + 1
  );
}

/**
 * Adds XP to a student's ranking for a subject.
 */
// export async function updateSubjectRanking({
//   studentId,
//   subjectId,
//   classId,
//   xp,
//   tx,
// }) {
//   if (!studentId) {
//     throw new Error("studentId is required.");
//   }

//   if (!subjectId) {
//     throw new Error("subjectId is required.");
//   }

//   if (!classId) {
//     throw new Error("classId is required.");
//   }

//   if (xp <= 0) {
//     throw new Error("XP must be greater than zero.");
//   }

//   console.log({
//   studentId,
//   subjectId,
//   classId,
// });

//   let ranking = await tx.subjectRanking.findUnique({
//     where: {
//       studentId_subjectId: {
//         studentId,
//         subjectId,
//       },
//     },
//   });

//   if (!ranking) {
//     ranking = await tx.subjectRanking.create({
//       data: {
//         studentId,
//         subjectId,
//         classId,
//         xp: 0,
//         level: 1,
//       },
//     });
//   }

//   const newXP = ranking.xp + xp;
//   const newLevel = calculateSubjectLevel(newXP);

//   return await tx.subjectRanking.update({
//     where: {
//       id: ranking.id,
//     },
//     data: {
//       xp: newXP,
//       level: newLevel,
//     },
//   });
// }

export async function updateSubjectRanking({
  studentId,
  subjectId,
  classId,
  xp,
  tx,
}) {
  if (!studentId) {
    throw new Error("studentId is required.");
  }

  if (!subjectId) {
    throw new Error("subjectId is required.");
  }

  if (!classId) {
    throw new Error("classId is required.");
  }

  if (xp <= 0) {
    throw new Error("XP must be greater than zero.");
  }

  const ranking = await tx.subjectRanking.upsert({
    where: {
      studentId_subjectId: {
        studentId,
        subjectId,
      },
    },
    create: {
      studentId,
      subjectId,
      classId,
      xp,
      level: calculateSubjectLevel(xp),
    },
    update: {
      xp: {
        increment: xp,
      },
    },
  });

  const updatedXP = ranking.xp;
  const updatedLevel =
    calculateSubjectLevel(updatedXP);

  if (updatedLevel === ranking.level) {
    return ranking;
  }

  return await tx.subjectRanking.update({
    where: {
      id: ranking.id,
    },
    data: {
      level: updatedLevel,
    },
  });
}

export async function getSubjectRanking({
  studentId,
  subjectId,
}) {
  return await db.subjectRanking.findUnique({
    where: {
      studentId_subjectId: {
        studentId,
        subjectId,
      },
    },
  });
}