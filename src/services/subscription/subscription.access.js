

import { getSubscription } from "./subscription.service.js";

import { checkUsage } from "./subscription.usage.js";

import {
  FEATURE_PLAN_MAPPING,
  LIMITED_FEATURES,
  SUBSCRIPTION_MESSAGES,
} from "./subscription.constants.js";


export async function checkSubscriptionAccess({
  userId,
  studentId,
  feature,
}) {
  try {
    const subscriptionResult =
      await getSubscription({
        userId,
        studentId,
      });

    if (!subscriptionResult.success) {
      return subscriptionResult;
    }

    const {
      accountId,
      subscription,
      plan,
    } = subscriptionResult;

    /**
     * Handle usage-limited features.
     */
    if (
      LIMITED_FEATURES.includes(feature)
    ) {
      const usageResult =
        await checkUsage({
          accountId,
          plan,
          feature,
        });

      if (!usageResult.success) {
        return usageResult;
      }

      return {
        success: true,

        feature,

        accountId,

        subscription,

        plan,

        usage: {
          used: usageResult.used,
          limit: usageResult.limit,
          remaining:
            usageResult.remaining,
          unlimited:
            usageResult.unlimited,
        },
      };
    }

    /**
     * Handle boolean features.
     */
    const permissionField =
      FEATURE_PLAN_MAPPING[
        feature
      ];

    if (!permissionField) {
      return {
        success: false,
        message:
          SUBSCRIPTION_MESSAGES.UNKNOWN_FEATURE,
      };
    }

    if (!plan[permissionField]) {
      return {
        success: false,
        message:
          SUBSCRIPTION_MESSAGES.FEATURE_NOT_ALLOWED,
      };
    }

    return {
      success: true,

      feature,

      accountId,

      subscription,

      plan,
    };
  } catch (error) {
    console.error(
      "Subscription Access:",
      error
    );

    return {
      success: false,
      message:
        "Unable to validate subscription access.",
    };
  }
}