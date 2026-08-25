import {
  getLeaderboard,
} from "../../services/gamification/leaderboard.service.js";

import {
  resolveStudent,
} from "../../services/elevenLabs/studentResolver.service.js";

export async function leaderboard(req, res) {
  try {
    const userId = req.user.userId;

    const studentId =
      req.query.studentId || null;

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

    const data =
      await getLeaderboard({
        userId,

        studentId: student.id,

        subjectId:
          req.query.subjectId || undefined,

        page: Number(
          req.query.page || 1
        ),

        limit: Number(
          req.query.limit || 20
        ),
      });

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error(
      "LEADERBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to load leaderboard.",
    });
  }
}

// import {
//   getLeaderboard,
// } from "../../services/gamification/leaderboard.service.js";

// export async function leaderboard(
//   req,
//   res
// ) {
//   try {

//     const userId = req.user.userId;

//     // console.log(userId)

//     const data =
//       await getLeaderboard({
//         userId,
        
//         studentId:
//           req.query.studentId,

//         subjectId:
//           req.query.subjectId,

//         page: Number(
//           req.query.page || 1
//         ),

//         limit: Number(
//           req.query.limit || 20
//         ),
//       });

//     return res.status(200).json({
//       success: true,
//       ...data,
//     });
//   } catch (error) {
//     console.error(error);

//     return res.status(500).json({
//       success: false,
//       message:
//         error.message ??
//         "Failed to load leaderboard.",
//     });
//   }
// }