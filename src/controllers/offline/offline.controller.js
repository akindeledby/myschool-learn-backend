import { syncOfflineContent } from "../../services/offline/offline.sync.js";
import { resolveStudent } from "../../services/elevenLabs/studentResolver.service.js";
import { processOfflineTestSubmission } from "../../services/offline/processOfflineTestSubmission.service.js";
import { checkSubscriptionAccess } from "../../services/subscription/subscription.access.js";
import { SUBSCRIPTION_FEATURES } from "../../services/subscription/subscription.constants.js";

export async function handleOfflineQuizAttemptSync(req, res) {
  try {
    // ---------------------------------------------------------
    // 1. Authentication
    // ---------------------------------------------------------

    const userId = req.user?.userId;
    

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized.",
      });
    }

    // ---------------------------------------------------------
    // 2. Read student ID
    //
    // Parent accounts can have multiple students.
    // resolveStudent() verifies that the authenticated
    // account is actually authorized to access this student.
    // ---------------------------------------------------------

    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        error: "studentId is required.",
      });
    }

    // ---------------------------------------------------------
    // 3. Resolve and authorize student
    // ---------------------------------------------------------

    const student = await resolveStudent({
      userId,
      studentId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "You are not authorized to access this student.",
      });
    }


    // ---------------------------------------------------------
    // 4. Verify offline-content entitlement
    //
    // The server remains authoritative.
    // ---------------------------------------------------------

    const offlineFeature =
      await checkSubscriptionAccess({
        userId,
        studentId: student.id,
        feature:
          SUBSCRIPTION_FEATURES.OFFLINE_CONTENT,
      });

    if (!offlineFeature.success) {
      return res.status(403).json({
        error:
          offlineFeature.message ||
          "Offline content is not enabled for this subscription.",
      });
    }

    // ---------------------------------------------------------
    // 5. Read submission data
    // ---------------------------------------------------------

    const {
      clientAttemptId,
      quizId = null,
      subjectId,
      termId,
      noOfQuestions,
      answers,
    } = req.body;

    // ---------------------------------------------------------
    // 6. Basic request validation
    // ---------------------------------------------------------

    if (!clientAttemptId) {
      return res.status(400).json({
        error: "clientAttemptId is required.",
      });
    }

    if (typeof clientAttemptId !== "string") {
      return res.status(400).json({
        error: "clientAttemptId must be a string.",
      });
    }

    if (clientAttemptId.length > 200) {
      return res.status(400).json({
        error: "clientAttemptId is too long.",
      });
    }

    if (!subjectId) {
      return res.status(400).json({
        error: "subjectId is required.",
      });
    }

    if (!termId) {
      return res.status(400).json({
        error: "termId is required.",
      });
    }

    if (
      !Number.isInteger(noOfQuestions) ||
      noOfQuestions <= 0
    ) {
      return res.status(400).json({
        error:
          "noOfQuestions must be a positive integer.",
      });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        error: "answers must be an array.",
      });
    }

    if (answers.length !== noOfQuestions) {
      return res.status(400).json({
        error:
          "The number of submitted answers must match noOfQuestions.",
      });
    }

    // ---------------------------------------------------------
    // 7. Process the offline submission
    // ---------------------------------------------------------

    const result =
      await processOfflineTestSubmission({
        studentId: student.id,
        clientAttemptId,
        quizId,
        subjectId,
        termId,
        noOfQuestions,
        answers,
      });

    // ---------------------------------------------------------
    // 8. Return service result
    // ---------------------------------------------------------

    if (!result.success) {
      return res.status(
        result.statusCode || 400
      ).json({
        error:
          result.message ||
          "Unable to synchronize offline test submission.",
      });
    }

    return res.status(200).json({
      message:
        result.message ||
        "Offline test submission synchronized successfully.",

      ...result.data,
    });
  } catch (error) {
    console.error(
      "HANDLE OFFLINE QUIZ ATTEMPT SYNC ERROR:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to synchronize offline test submission.",
    });
  }
}


export async function handleOfflineSync(req, res) {
  try {
    const userId = req.user?.userId;
    const { studentId } = req.body || {};

    const result = await syncOfflineContent({
      userId,
      studentId,
    });

    return res
      .status(result.statusCode || (result.success ? 200 : 400))
      .json(result);
  } catch (error) {
    console.error("Offline Sync Controller Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to synchronize offline content.",
    });
  }
}
