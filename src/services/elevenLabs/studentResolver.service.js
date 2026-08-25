import { db } from "../../../lib/db.js";

export async function resolveStudent({ userId, studentId }) {

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      parent: true,
    },
  });

  if (!user) return null;

  // If selecting a specific student (parent or switch context)
  if (studentId) {
    return db.student.findFirst({
      where: {
        id: studentId,
        accountId: user.accountId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        classLevel: true,
        classId: true,
        gender: true,
        age: true,
        school: true
      },
    });
  }

  // default logged-in student
  return db.student.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      classLevel: true,
      gender: true,
      age: true,
      classId: true,
      school: true
    },
  });
}