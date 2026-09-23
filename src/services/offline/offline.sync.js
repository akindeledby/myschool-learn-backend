import { checkSubscriptionAccess } from "../subscription/subscription.access.js";
import { SUBSCRIPTION_FEATURES } from "../subscription/subscription.constants.js";

import { getAuthorizedStudent } from "./offline.authorization.js";
import { getAuthorizedOfflineContent } from "./offline.content.js";

/**
 * Build the complete offline synchronization package
 * for an authenticated user/student.
 *
 * Responsibilities:
 *
 * 1. Verify that the authenticated user can access
 *    the requested student.
 *
 * 2. Verify that the student's current subscription
 *    permits offline content.
 *
 * 3. Determine the actual offline subscription expiry.
 *
 * 4. Determine which specific offline features are
 *    available under the student's subscription plan.
 *
 * 5. Retrieve the student's authorized learning content.
 *
 * 6. Return a complete package that the frontend can
 *    store in IndexedDB.
 *
 * IMPORTANT:
 * IndexedDB is NOT trusted by this service.
 *
 * Subscription, permission, student authorization,
 * content authorization, and expiry information all
 * come from the backend/database.
 */
export async function syncOfflineContent({
  userId,
  studentId,
}) {
  /**
   * ---------------------------------------------------------
   * 1. Validate authenticated user
   * ---------------------------------------------------------
   */

  if (!userId) {
    return {
      success: false,
      statusCode: 401,
      message: "Unauthorized.",
    };
  }

  try {
    /**
     * -------------------------------------------------------
     * 2. Resolve and authorize the requested student
     * -------------------------------------------------------
     *
     * This handles both:
     *
     * Student account:
     *   authenticated User → Student
     *
     * Parent account:
     *   authenticated User → Parent → Student
     *
     * The authorization helper prevents a user from
     * requesting another student's content.
     */
    const authorizationResult =
      await getAuthorizedStudent({
        userId,
        studentId,
      });

    if (!authorizationResult.success) {
      return authorizationResult;
    }

    const student =
      authorizationResult.student;

    /**
     * -------------------------------------------------------
     * 3. Verify offline-content subscription access
     * -------------------------------------------------------
     *
     * The server is authoritative.
     *
     * We deliberately do NOT trust:
     *
     * - IndexedDB
     * - cached frontend permissions
     * - cached subscription information
     * - frontend feature flags
     *
     * Passing student.id is important because parent accounts
     * may have multiple students.
     */
    const subscriptionResult =
      await checkSubscriptionAccess({
        userId,
        studentId: student.id,
        feature:
          SUBSCRIPTION_FEATURES.OFFLINE_CONTENT,
      });

    if (!subscriptionResult.success) {
      return {
        success: false,
        statusCode: 403,
        message:
          subscriptionResult.message ||
          "Offline content is not available for this subscription.",
      };
    }

    /**
     * checkSubscriptionAccess() has already verified that
     * OFFLINE_CONTENT is permitted by the current plan.
     */
    const {
      accountId,
      subscription,
      plan,
    } = subscriptionResult;

    /**
     * -------------------------------------------------------
     * 4. Determine offline subscription expiry
     * -------------------------------------------------------
     *
     * The subscription's actual endsAt is the source
     * of truth.
     *
     * Lifetime subscriptions have no expiry.
     */
    let expiresAt = null;

    if (!subscription.isLifetime) {
      if (!subscription.endsAt) {
        console.error(
          "OFFLINE SUBSCRIPTION ERROR: Non-lifetime subscription has no endsAt.",
          {
            accountId,
            subscriptionId:
              subscription.id,
            studentId: student.id,
          }
        );

        return {
          success: false,
          statusCode: 500,
          message:
            "Unable to determine offline subscription expiry.",
        };
      }

      expiresAt =
        subscription.endsAt;
    }

    /**
     * -------------------------------------------------------
     * 5. Determine available offline features
     * -------------------------------------------------------
     */
    const offlineFeatures = {
      takeTest: Boolean(
        plan.canTakeTest
      ),

      practiceQuiz: Boolean(
        plan.canPracticeForQuiz
      ),

      practiceExam: Boolean(
        plan.canPracticeForExam
      ),

      cardGame: Boolean(
        plan.canPlayCardGame
      ),

      speedChallenge: Boolean(
        plan.canPlaySpeedChallange
      ),

      millionaire: Boolean(
        plan.canPlayMillionaire
      ),
    };

    /**
     * -------------------------------------------------------
     * 6. Retrieve authorized learning content
     * -------------------------------------------------------
     *
     * This already returns:
     *
     * - Subjects
     * - Terms
     * - Topics
     * - Quizzes
     * - Questions
     *
     * We will also use its subjects list to populate the
     * student's offline dashboard profile.
     */
    const contentResult =
      await getAuthorizedOfflineContent({
        studentId: student.id,
      });

    if (!contentResult.success) {
      return contentResult;
    }

    /**
     * -------------------------------------------------------
     * 7. Prepare student dashboard information
     * -------------------------------------------------------
     *
     * The student's subjects are obtained from the already
     * authorized offline content result.
     *
     * This avoids making another database query.
     */
    const studentSubjects =
      Array.isArray(
        contentResult.content?.subjects
      )
        ? contentResult.content.subjects.map(
            (subject) => subject.name
          )
        : [];

    /**
     * Subscription plan identifier/name.
     *
     * `plan.name` is preferred when available.
     * `plan.id` is used as a safe fallback.
     *
     * This preserves compatibility if the subscription
     * plan object does not expose a `name` field.
     */
    const subscriptionPlan =
      plan.subscriptionPlanName;

    /**
     * -------------------------------------------------------
     * 8. Create synchronization metadata
     * -------------------------------------------------------
     */
    const contentVersion = 1;

    const syncedAt =
      new Date().toISOString();

    const syncId =
      `${student.id}-${Date.now()}`;

    /**
     * -------------------------------------------------------
     * 9. Return complete offline synchronization package
     * -------------------------------------------------------
     *
     * The frontend can now store:
     *
     * student
     * entitlement
     * content
     *
     * in IndexedDB.
     */
    return {
      success: true,

      sync: {
        syncId,

        syncedAt,

        contentVersion,

        student: {
          id: student.id,

          firstName:
            student.firstName,

          lastName:
            student.lastName,

          playingLevel:
            student.playingLevel ?? 0,

          subscriptionPlan:
            plan.subscriptionPlanName,

          subjects:
            studentSubjects,
        },

        offline: {
          enabled: true,

          expiresAt,

          features:
            offlineFeatures,
        },

        content:
          contentResult.content,
      },
    };
  } catch (error) {
    console.error(
      "Offline Sync Error:",
      error
    );

    return {
      success: false,
      statusCode: 500,
      message:
        "Unable to synchronize offline learning content.",
    };
  }
}