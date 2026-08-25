import { db } from "../../../lib/db.js";
import { resolveStudent } from "../elevenLabs/studentResolver.service.js";

const STUDENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  age: true,
  classLevel: true,
  gender: true,
  studentImageUrl: true,

  school: {
    select: {
      id: true,
      name: true,
    },
  },
};

/**
 * Universal Leaderboard
 *
 * If subjectId exists
 * return SubjectRanking leaderboard
 *
 * Otherwise return Account leaderboard.
 */
export async function getLeaderboard({
  userId,
  studentId,
  subjectId,
  page = 1,
  limit = 20,
  tx = db,
}) {

   //----------------------------------------------------
  // Resolve student
  //----------------------------------------------------

  const student =
    await resolveStudent({
      userId,
      studentId,
    });

  if (!student) {
    throw new Error(
      "Student not found."
    );
  }

  if (!student.classId) {
    throw new Error(
      "Student is not assigned to a class."
    );
  }

  const classId =
    student.classId;
  //----------------------------------------------------
  // Load every subject for the filter dropdown
  //----------------------------------------------------

  const classSubjects =
    await tx.classSubject.findMany({
      where: {
        classId,
      },

      select: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: {
        subject: {
          name: "asc",
        },
      },
    });

  const availableSubjects =
    classSubjects.map(
      (item) => item.subject
  );

  //----------------------------------------------------
  // SUBJECT LEADERBOARD
  //----------------------------------------------------

  if (subjectId) {
    const total =
      await tx.subjectRanking.count({
        where: {
          subjectId,

          student: {
            classId,
          },
        }
      });

    const rankings =
      await tx.subjectRanking.findMany({
        where: {
          subjectId,

          student: {
            classId,
          },
        },

        include: {
          student: {
            select:
              STUDENT_SELECT,
          },

          subject: {
            select: {
              id: true,
              name: true,
            },
          },
        },

        orderBy: [
          {
            level: "desc",
          },
          {
            xp: "desc",
          },
        ],

        skip:
          (page - 1) * limit,

        take: limit,
      });

    return {
      type: "subject",

      subjects: availableSubjects,

      selectedSubjectId:
        subjectId,

      leaderboard:
        rankings.map(
          (
            ranking,
            index
          ) => ({
            rank:
              (page - 1) *
                limit +
              index +
              1,

            student:
              ranking.student,

            subject:
              ranking.subject,

            xp:
              ranking.xp,

            level:
              ranking.level,
          })
        ),

      page,

      limit,

      total,

      totalPages:
        Math.ceil(
          total / limit
        ),
    };
  }

  //----------------------------------------------------
  // GLOBAL LEADERBOARD
  //----------------------------------------------------

  const total =
    await tx.studentProfile.count({
      where: {
        student: {
          classId,
        },
      },
    });

  const profiles =
    await tx.studentProfile.findMany({
      where: {
        student: {
          classId,
        },
      },
      include: {
        student: {
          select:
            STUDENT_SELECT,
        },
      },

      orderBy: [
        {
          level:
            "desc",
        },
        {
          xp:
            "desc",
        },
      ],

      skip:
        (page - 1) * limit,

      take: limit,
    });

  return {
    type: "global",

    subjects: availableSubjects,

    selectedSubjectId:
      null,

    leaderboard:
      profiles.map(
        (
          profile,
          index
        ) => ({
          rank:
            (page - 1) *
              limit +
            index +
            1,

          student:
            profile.student,

          xp:
            profile.xp,

          level:
            profile.level,

          totalGames:
            profile.totalGames,

          totalWins:
            profile.totalWins,

          streak:
            profile.streak,
        })
      ),

    page,

    limit,

    total,

    totalPages:
      Math.ceil(
        total / limit
      ),
  };
}