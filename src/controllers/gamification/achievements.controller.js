import { resolveStudent } from "../../services/elevenLabs/studentResolver.service.js";

import {
  getStudentAchievements, getAchievementsForStudent,
} from "../../services/gamification/achievement.service.js";

/**
 * GET /gamification/achievements
 */
export async function getAchievements(
  req,
  res
) {
  try {
    const userId =
      req.user.userId;

    const {
      studentId,
    } = req.query;

    // console.log("studentid", studentId)

    const student =
      await resolveStudent({
        userId,
        studentId,
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found.",
      });
    }

    const achievements =
      await getAchievementsForStudent({
        studentId:
          student.id,
      });

    return res.status(200).json({
      success: true,
      achievements
        
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to load achievements.",
    });
  }
}
