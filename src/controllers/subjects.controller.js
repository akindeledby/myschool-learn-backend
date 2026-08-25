import { db } from "../../lib/db.js";

export async function getStudentSubjects(
  req,
  res
) {
  try {
    const studentId = req.user.id;

    if(!studentId) {
      return res.status(401).json({
        success: false,
        message: "StudentId is required",
      });
    }

    const student =
      await db.student.findUnique({
        where: {
          id: studentId,
        },
        include: {
          class: true,
        },
      });

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    const subjects =
      await db.subject.findMany({
        where: {
          classId:
            student.classId,
        },

        orderBy: {
          name: "asc",
        },
      });

    return res.json(subjects);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message:
        "Failed to fetch subjects",
    });
  }
}