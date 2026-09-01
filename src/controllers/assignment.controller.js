import { db } from "../../lib/db.js";

import { buildAssignmentPrompt } from "../services/assignment/assignmentPrompt.ts";
import { generateAssignmentExplanation } from "../services/assignment/assignment.service.ts";
import { resolveStudent } from "../services/elevenLabs/studentResolver.service.js";

import { checkSubscriptionAccess } from "../services/subscription/subscription.access.js";
import { incrementUsage } from "../services/subscription/subscription.usage.js";
import { SUBSCRIPTION_FEATURES } from "../services/subscription/subscription.constants.js";

export async function explainAssignment(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const { studentId, question = "" } =
      req.body;

    /**
     * Resolve student
     */
    const student =
      await resolveStudent({
        userId,
        studentId,
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    /**
     * Check subscription access
     */
    const access =
      await checkSubscriptionAccess({
        userId,
        feature:
          SUBSCRIPTION_FEATURES.HOME_HELPER,
      });

    if (!access.success) {
      return res.status(403).json(access);
    }

    /**
     * Resolve class
     */
    const classLevel =
      await db.class.findUnique({
        where: {
          id: student.classId,
        },

        select: {
          name: true,
        },
      });

    if (!classLevel) {
      return res.status(404).json({
        success: false,
        message:
          "Class record not found",
      });
    }

    const file = req.file;

    /**
     * Build prompt
     */
    const prompt =
      buildAssignmentPrompt(
        classLevel.name,
        question
      );

    /**
     * Generate explanation
     */
    const answer =
      await generateAssignmentExplanation({
        prompt,
        fileBuffer:
          file?.buffer,
        mimeType:
          file?.mimetype,
      });

    if (!answer) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate explanation.",
      });
    }

    /**
     * Consume one usage only after
     * successful generation.
     */
    await incrementUsage({
      accountId:
        access.accountId,

      feature:
        SUBSCRIPTION_FEATURES.HOME_HELPER,

      plan:
        access.plan,
    });

    return res.status(200).json({
      success: true,
      answer,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to process assignment",
    });
  }
}
