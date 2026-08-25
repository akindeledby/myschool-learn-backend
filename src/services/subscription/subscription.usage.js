// services/subscription/subscription.usage.js

import { db } from "../../../lib/db.js";

import {
  FEATURE_LIMIT_MAPPING,
  SUBSCRIPTION_MESSAGES,
  SUBSCRIPTION_FEATURES,
} from "./subscription.constants.js";

/**
 * Creates or retrieves a usage record.
 */
async function getOrCreateUsage({
  accountId,
  feature,
}) {
  return db.subscriptionUsage.upsert({
    where: {
      accountId_feature: {
        accountId,
        feature,
      },
    },

    update: {},

    create: {
      accountId,
      feature,
      used: 0,
    },
  });
}

/**
 * Returns usage information for a feature.
 */
export async function getUsage({
  accountId,
  feature,
}) {
  return getOrCreateUsage({
    accountId,
    feature,
  });
}

/**
 * Checks whether a quota-limited feature
 * can still be used.
 */
export async function checkUsage({
  accountId,
  plan,
  feature,
}) {
  const limitField =
    FEATURE_LIMIT_MAPPING[feature];

  if (!limitField) {
    return {
      success: false,
      message:
        SUBSCRIPTION_MESSAGES.UNKNOWN_FEATURE,
    };
  }

  const limit =
    plan[limitField];

  /**
   * Null means unlimited.
   */
  if (limit === null) {
    return {
      success: true,

      unlimited: true,

      limit: null,

      used: 0,

      remaining: null,
    };
  }

  const usage =
    await getOrCreateUsage({
      accountId,
      feature,
    });

  const remaining =
    Math.max(
      0,
      limit - usage.used
    );

  if (usage.used >= limit) {
    return {
      success: false,

      message:
        SUBSCRIPTION_MESSAGES.FEATURE_LIMIT_REACHED,

      used: usage.used,

      limit,

      remaining: 0,
    };
  }

  return {
    success: true,

    unlimited: false,

    limit,

    used: usage.used,

    remaining,
  };
}

/**
 * Consumes one usage after
 * a successful action.
 */
export async function incrementUsage({
  accountId,
  feature,
  plan,
}) {
  const usage = await getOrCreateUsage({
    accountId,
    feature,
  });

  const updated = await db.subscriptionUsage.update({
    where: {
      id: usage.id,
    },
    data: {
      used: {
        increment: 1,
      },
    },
  });

  const limitField = FEATURE_LIMIT_MAPPING[feature];
  const limit = plan[limitField];

  return {
    success: true,
    feature,
    used: updated.used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - updated.used),
  };
}

/**
 * Decrements usage.
 *
 * Useful if an operation is rolled back.
 */
export async function decrementUsage({
  accountId,
  feature,
}) {
  const usage =
    await getOrCreateUsage({
      accountId,
      feature,
    });

  if (usage.used === 0) {
    return usage;
  }

  return db.subscriptionUsage.update({
    where: {
      id: usage.id,
    },

    data: {
      used: {
        decrement: 1,
      },
    },
  });
}

/**
 * Resets usage.
 *
 * Can be called during renewal.
 */
export async function resetUsage({
  accountId,
  feature,
}) {
  return db.subscriptionUsage.update({
    where: {
      accountId_feature: {
        accountId,
        feature,
      },
    },

    data: {
      used: 0,
    },
  });
}

export async function unlockVideoLesson({
  accountId,
  topicId,
  plan,
}) {
  const existing =
    await db.unlockedVideoLesson.findUnique({
      where: {
        accountId_topicId: {
          accountId,
          topicId,
        },
      },
    });

  /**
   * Already unlocked.
   * Don't consume another usage.
   */
  if (existing) {
    return {
      success: true,
      alreadyUnlocked: true,
    };
  }

  /**
   * Consume one lesson.
   */
  await incrementUsage({
    accountId,
    feature:
      SUBSCRIPTION_FEATURES.VIDEO_LESSON,
    plan,
  });

  await db.unlockedVideoLesson.create({
    data: {
      accountId,
      topicId,
    },
  });

  return {
    success: true,
    alreadyUnlocked: false,
  };
}