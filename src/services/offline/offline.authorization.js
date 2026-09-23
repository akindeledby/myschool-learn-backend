import { db } from "../../../lib/db.js";

/**
 * Resolve the student that the authenticated user
 * is authorized to access.
 *
 * Rules:
 *
 * 1. Student account:
 *    - The authenticated User must own the Student record
 *      through Student.userId.
 *    - A supplied studentId is ignored/rejected.
 *
 * 2. Parent account:
 *    - A studentId must be supplied.
 *    - The student must belong to the parent's account.
 *    - The student must also be linked to the authenticated Parent.
 */
export async function getAuthorizedStudent({
  userId,
  studentId,
}) {
  if (!userId) {
    return {
      success: false,
      statusCode: 401,
      message: "Unauthorized.",
    };
  }

  try {
    /**
     * First determine who the authenticated user is.
     */
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
        accountId: true,
        parent: {
          select: {
            id: true,
          },
        },
        student: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      return {
        success: false,
        statusCode: 401,
        message: "User not found.",
      };
    }

    /**
     * --------------------------------------------------
     * STUDENT
     * --------------------------------------------------
     *
     * A student can only access their own Student record.
     */
    if (user.student) {
      const student = await db.student.findFirst({
        where: {
          userId: user.id,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          accountId: true,
          userId: true,
          parentId: true,

          /**
           * The student's playing level is stored
           * in StudentProfile, not Student.
           */
          studentProfile: {
            select: {
              level: true,
            },
          },
        },
      });

      if (!student) {
        return {
          success: false,
          statusCode: 404,
          message: "Student record not found.",
        };
      }

      /**
       * If a student supplied a different studentId,
       * do not allow them to switch identities.
       */
      if (
        studentId &&
        studentId !== student.id
      ) {
        return {
          success: false,
          statusCode: 403,
          message:
            "You are not authorized to access this student.",
        };
      }

      return {
        success: true,
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          accountId: student.accountId,
          userId: student.userId,
          parentId: student.parentId,

          /**
           * Normalize StudentProfile.level so callers
           * do not need to know about the database relation.
           */
          playingLevel:
            student.studentProfile?.level ?? 0,
        },
      };
    }

    /**
     * --------------------------------------------------
     * PARENT
     * --------------------------------------------------
     *
     * A parent must explicitly identify the child
     * whose offline content is being downloaded.
     */
    if (user.parent) {
      if (!studentId) {
        return {
          success: false,
          statusCode: 400,
          message:
            "studentId is required for parent accounts.",
        };
      }

      if (!user.accountId) {
        return {
          success: false,
          statusCode: 403,
          message:
            "Parent account is not properly configured.",
        };
      }

      const student = await db.student.findFirst({
        where: {
          id: studentId,

          /**
           * Account-level authorization.
           */
          accountId: user.accountId,

          /**
           * Parent-level authorization.
           */
          parent: {
            userId: user.id,
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          accountId: true,
          userId: true,
          parentId: true,

          /**
           * The student's playing level is stored
           * in StudentProfile, not Student.
           */
          studentProfile: {
            select: {
              level: true,
            },
          },
        },
      });

      if (!student) {
        return {
          success: false,
          statusCode: 403,
          message:
            "You are not authorized to access this student.",
        };
      }

      return {
        success: true,
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          accountId: student.accountId,
          userId: student.userId,
          parentId: student.parentId,

          /**
           * Normalize StudentProfile.level.
           */
          playingLevel:
            student.studentProfile?.level ?? 0,
        },
      };
    }

    /**
     * Any other user type is not permitted to use
     * this student-content authorization flow.
     */
    return {
      success: false,
      statusCode: 403,
      message:
        "This account is not authorized to access student content.",
    };
  } catch (error) {
    console.error(
      "Get Authorized Student Error:",
      error
    );

    return {
      success: false,
      statusCode: 500,
      message:
        "Unable to verify student access.",
    };
  }
}