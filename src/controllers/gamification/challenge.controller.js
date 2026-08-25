import { resolveStudent } from "../../services/elevenLabs/studentResolver.service.js";

import {
  getStudentChallenges,
} from "../../services/gamification/challenge.service.js";

/**
 * GET /api/gamification/challenges
 *
 * Returns all daily challenges together
 * with the student's completion status.
 */
export async function getChallenges(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const { studentId } = req.query;

    const student =
      await resolveStudent({
        userId,
        studentId,
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const challenges =
      await getStudentChallenges({
        studentId: student.id,
      });

    return res.status(200).json({
      success: true,
      challenges,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to load daily challenges.",
    });
  }
}