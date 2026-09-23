import crypto from "crypto";
import { db } from "../../../lib/db.js";
import { processTestSubmission } from "../tests/processTestSubmission.service.js";

/**
 * Process one completed offline test submission.
 *
 * Responsibilities:
 * - Validate the offline submission.
 * - Generate a deterministic payload hash.
 * - Detect previously processed attempts.
 * - Protect clientAttemptId from being reused with different data.
 * - Process grading and analytics through processTestSubmission().
 * - Store OfflineTestSubmission as the idempotency ledger.
 *
 * IMPORTANT:
 *
 * StudentScore + TopicAnalytics + OfflineTestSubmission
 * are written inside ONE Prisma transaction.
 *
 * Therefore, either everything succeeds or everything rolls back.
 */

export async function processOfflineTestSubmission({
  studentId,
  clientAttemptId,
  quizId = null,
  subjectId,
  termId,
  noOfQuestions,
  answers,
}) {
  // ---------------------------------------------------------
  // 1. Basic validation
  // ---------------------------------------------------------

  if (!studentId) {
    return {
      success: false,
      statusCode: 400,
      message: "studentId is required.",
    };
  }

  if (!clientAttemptId) {
    return {
      success: false,
      statusCode: 400,
      message: "clientAttemptId is required.",
    };
  }

  if (typeof clientAttemptId !== "string") {
    return {
      success: false,
      statusCode: 400,
      message: "clientAttemptId must be a string.",
    };
  }

  if (clientAttemptId.length > 200) {
    return {
      success: false,
      statusCode: 400,
      message: "clientAttemptId is too long.",
    };
  }

  if (!subjectId) {
    return {
      success: false,
      statusCode: 400,
      message: "subjectId is required.",
    };
  }

  if (!termId) {
    return {
      success: false,
      statusCode: 400,
      message: "termId is required.",
    };
  }

  if (
    !Number.isInteger(noOfQuestions) ||
    noOfQuestions <= 0
  ) {
    return {
      success: false,
      statusCode: 400,
      message:
        "noOfQuestions must be a positive integer.",
    };
  }

  if (!Array.isArray(answers)) {
    return {
      success: false,
      statusCode: 400,
      message: "answers must be an array.",
    };
  }

  // ---------------------------------------------------------
  // 2. Generate deterministic payload hash
  //
  // The hash allows us to detect an attempt ID being reused
  // with different submission data.
  // ---------------------------------------------------------

  const payloadForHash = {
    studentId,
    clientAttemptId,
    quizId,
    subjectId,
    termId,
    noOfQuestions,
    answers,
  };

  const payloadHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(payloadForHash))
    .digest("hex");

  try {
    // -------------------------------------------------------
    // 3. Fast idempotency check
    //
    // This avoids opening a transaction for the very common
    // case where the browser retries an already processed
    // submission.
    // -------------------------------------------------------

    const existingSubmission =
      await db.offlineTestSubmission.findUnique({
        where: {
          studentId_clientAttemptId: {
            studentId,
            clientAttemptId,
          },
        },
      });

    if (existingSubmission) {
      // -----------------------------------------------------
      // Same attempt ID but different payload
      // -----------------------------------------------------

      if (
        existingSubmission.payloadHash !==
        payloadHash
      ) {
        console.error(
          "OFFLINE ATTEMPT PAYLOAD HASH MISMATCH:",
          {
            studentId,
            clientAttemptId,
          }
        );

        return {
          success: false,
          statusCode: 409,
          message:
            "This offline attempt has already been submitted with different data.",
        };
      }

      // -----------------------------------------------------
      // Already successfully processed
      // -----------------------------------------------------

      return {
        success: true,
        statusCode: 200,
        message:
          "Offline test submission was already processed.",

        data: {
          alreadyProcessed: true,

          submissionId:
            existingSubmission.id,

          clientAttemptId:
            existingSubmission.clientAttemptId,

          result:
            existingSubmission.result,
        },
      };
    }

    // -------------------------------------------------------
    // 4. Start atomic transaction
    // -------------------------------------------------------

    const result = await db.$transaction(
      async (tx) => {
        // ---------------------------------------------------
        // IMPORTANT:
        //
        // Re-check inside the transaction.
        //
        // Another request may have created the submission
        // after our initial findUnique() but before this
        // transaction started.
        // ---------------------------------------------------

        const transactionExistingSubmission =
          await tx.offlineTestSubmission.findUnique({
            where: {
              studentId_clientAttemptId: {
                studentId,
                clientAttemptId,
              },
            },
          });

        if (transactionExistingSubmission) {
          // -----------------------------------------------
          // Protect against reused attempt ID
          // -----------------------------------------------

          if (
            transactionExistingSubmission.payloadHash !==
            payloadHash
          ) {
            return {
              alreadyProcessed: false,
              conflict: true,
            };
          }

          // -----------------------------------------------
          // Another request already processed it.
          // -----------------------------------------------

          return {
            alreadyProcessed: true,

            submission:
              transactionExistingSubmission,
          };
        }

        // ---------------------------------------------------
        // 5. Process authoritative test submission
        //
        // The supplied tx means:
        //
        // StudentScore
        // TopicAnalytics
        //
        // are written inside THIS transaction.
        // ---------------------------------------------------

        const processed =
          await processTestSubmission({
            studentId,
            subjectId,
            termId,
            noOfQuestions,
            answers,
            quizId,
            tx,
          });

        // ---------------------------------------------------
        // 6. If grading/validation failed, throw an error
        //    so no OfflineTestSubmission is created and
        //    the transaction rolls back.
        // ---------------------------------------------------

        if (!processed.success) {
          const error = new Error(
            processed.message ||
              "Unable to process offline test submission."
          );

          error.statusCode =
            processed.statusCode || 400;

          error.isSubmissionValidationError = true;

          throw error;
        }

        // ---------------------------------------------------
        // 7. Store the official result in the idempotency
        //    ledger.
        // ---------------------------------------------------

        const submission =
          await tx.offlineTestSubmission.create({
            data: {
              studentId,

              clientAttemptId,

              quizId,

              payloadHash,

              result:
                processed.data,
            },
          });

        // ---------------------------------------------------
        // 8. Return everything needed after commit
        // ---------------------------------------------------

        return {
          alreadyProcessed: false,

          submission,

          result:
            processed.data,
        };
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );

    // ---------------------------------------------------------
    // 9. Existing submission discovered inside transaction
    // ---------------------------------------------------------

    if (result.conflict) {
      return {
        success: false,
        statusCode: 409,
        message:
          "This offline attempt has already been submitted with different data.",
      };
    }

    if (result.alreadyProcessed) {
      return {
        success: true,
        statusCode: 200,

        message:
          "Offline test submission was already processed.",

        data: {
          alreadyProcessed: true,

          submissionId:
            result.submission.id,

          clientAttemptId,

          result:
            result.submission.result,
        },
      };
    }

    // ---------------------------------------------------------
    // 10. Successfully processed new offline submission
    // ---------------------------------------------------------

    return {
      success: true,
      statusCode: 200,

      message:
        "Offline test submission processed successfully.",

      data: {
        alreadyProcessed: false,

        submissionId:
          result.submission.id,

        clientAttemptId,

        result:
          result.result,
      },
    };
  } catch (error) {
    // ---------------------------------------------------------
    // 11. Expected validation/grading error
    // ---------------------------------------------------------

    if (
      error?.isSubmissionValidationError
    ) {
      return {
        success: false,

        statusCode:
          error.statusCode || 400,

        message:
          error.message ||
          "Unable to process offline test submission.",
      };
    }

    // ---------------------------------------------------------
    // 12. Unique constraint race
    //
    // The database unique constraint remains the final safety
    // net if two requests attempt to create the same record
    // simultaneously.
    // ---------------------------------------------------------

    if (error?.code === "P2002") {
      const existingSubmission =
        await db.offlineTestSubmission.findUnique({
          where: {
            studentId_clientAttemptId: {
              studentId,
              clientAttemptId,
            },
          },
        });

      if (existingSubmission) {
        if (
          existingSubmission.payloadHash !==
          payloadHash
        ) {
          return {
            success: false,
            statusCode: 409,
            message:
              "This offline attempt has already been submitted with different data.",
          };
        }

        return {
          success: true,
          statusCode: 200,

          message:
            "Offline test submission was already processed.",

          data: {
            alreadyProcessed: true,

            submissionId:
              existingSubmission.id,

            clientAttemptId,

            result:
              existingSubmission.result,
          },
        };
      }
    }

    // ---------------------------------------------------------
    // 13. Unexpected server/database error
    // ---------------------------------------------------------

    console.error(
      "PROCESS OFFLINE TEST SUBMISSION ERROR:",
      error
    );

    return {
      success: false,
      statusCode: 500,
      message:
        "Unable to process offline test submission.",
    };
  }
}