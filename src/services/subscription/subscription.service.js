// services/subscription/subscription.service.js

import { db } from "../../../lib/db.js";

import {
  SUBSCRIPTION_MESSAGES,
} from "./subscription.constants.js";

/**
 * Resolve an Account ID from either a User ID
 * or Student ID.
 */
export async function getAccountId({
  userId,
  studentId,
}) {
  if (!userId && !studentId) {
    return {
      success: false,
      message:
        "Either userId or studentId must be provided.",
    };
  }

  if (userId) {
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        accountId: true,
      },
    });

    if (!user) {
      return {
        success: false,
        message:
          SUBSCRIPTION_MESSAGES.USER_NOT_FOUND,
      };
    }

    if (!user.accountId) {
      return {
        success: false,
        message:
          SUBSCRIPTION_MESSAGES.ACCOUNT_NOT_FOUND,
      };
    }

    return {
      success: true,
      accountId: user.accountId,
      userId: user.id,
    };
  }

  const student =
    await db.student.findUnique({
      where: {
        id: studentId,
      },

      select: {
        id: true,
        accountId: true,
      },
    });

  if (!student) {
    return {
      success: false,
      message:
        SUBSCRIPTION_MESSAGES.STUDENT_NOT_FOUND,
    };
  }

  if (!student.accountId) {
    return {
      success: false,
      message:
        SUBSCRIPTION_MESSAGES.ACCOUNT_NOT_FOUND,
    };
  }

  return {
    success: true,
    accountId: student.accountId,
    studentId: student.id,
  };
}

/**
 * Returns the active subscription together
 * with its subscription plan.
 */
export async function getSubscription({
  userId,
  studentId,
}) {
  try {
    const account =
      await getAccountId({
        userId,
        studentId,
      });

    if (!account.success) {
      return account;
    }

    const subscription =
      await db.subscription.findUnique({
        where: {
          accountId:
            account.accountId,
        },

        include: {
          subscriptionPlan: true,
        },
      });

    if (!subscription) {
      return {
        success: false,
        message:
          SUBSCRIPTION_MESSAGES.SUBSCRIPTION_NOT_FOUND,
      };
    }

    if (
      subscription.status !==
      "ACTIVE"
    ) {
      return {
        success: false,
        message:
          SUBSCRIPTION_MESSAGES.SUBSCRIPTION_INACTIVE,
      };
    }

    if (
      !subscription.isLifetime &&
      subscription.endsAt &&
      subscription.endsAt <
        new Date()
    ) {
      return {
        success: false,
        message:
          SUBSCRIPTION_MESSAGES.SUBSCRIPTION_EXPIRED,
      };
    }

    return {
      success: true,

      accountId:
        account.accountId,

      subscription,

      plan:
        subscription.subscriptionPlan,
    };
  } catch (error) {
    console.error(
      "Subscription Service:",
      error
    );

    return {
      success: false,
      message:
        "Unable to validate subscription.",
    };
  }
}