// services/subscription/subscription.constants.js

/**
 * Features that can be protected by a subscription plan.
 */
export const SUBSCRIPTION_FEATURES = Object.freeze({
  VIDEO_LESSON: "VIDEO_LESSON",

  HOME_HELPER: "HOME_HELPER",

  TAKE_TEST: "TAKE_TEST",

  PRACTICE_EXAM: "PRACTICE_EXAM",

  PRACTICE_QUIZ: "PRACTICE_QUIZ",

  AI_CHAT: "AI_CHAT",

  SPEAK_WITH_TEACHER: "SPEAK_WITH_TEACHER",

  CARD_GAME: "CARD_GAME",

  SPEED_CHALLENGE: "SPEED_CHALLENGE",

  MILLIONAIRE: "MILLIONAIRE",

  LEADERBOARD: "LEADERBOARD",
});


/**
 * Features that are usage-based rather than simple
 * true/false permissions.
 *
 * These require checking SubscriptionUsage.
 */
export const LIMITED_FEATURES = Object.freeze([
  SUBSCRIPTION_FEATURES.VIDEO_LESSON,

  SUBSCRIPTION_FEATURES.HOME_HELPER,
]);


/**
 * Maps a feature to its corresponding boolean field
 * on the SubscriptionPlan model.
 *
 * Usage-limited features are intentionally omitted
 * because they are handled by subscription.usage.js.
 */
export const FEATURE_PLAN_MAPPING = Object.freeze({
  [SUBSCRIPTION_FEATURES.TAKE_TEST]:
    "canTakeTest",

  [SUBSCRIPTION_FEATURES.PRACTICE_EXAM]:
    "canPracticeForExam",

  [SUBSCRIPTION_FEATURES.PRACTICE_QUIZ]:
    "canPracticeForQuiz",

  [SUBSCRIPTION_FEATURES.AI_CHAT]:
    "canChatWithLearningAssistant",

  [SUBSCRIPTION_FEATURES.SPEAK_WITH_TEACHER]:
    "canSpeakWithTeacher",

  [SUBSCRIPTION_FEATURES.CARD_GAME]:
    "canPlayCardGame",

  [SUBSCRIPTION_FEATURES.SPEED_CHALLENGE]:
    "canPlaySpeedChallange",

  [SUBSCRIPTION_FEATURES.MILLIONAIRE]:
    "canPlayMillionaire",

  [SUBSCRIPTION_FEATURES.LEADERBOARD]:
    "canPartakeInLeaderboardRanking",
});


/**
 * Maps usage-limited features to the limit field
 * on the SubscriptionPlan model.
 */
export const FEATURE_LIMIT_MAPPING = Object.freeze({
  [SUBSCRIPTION_FEATURES.VIDEO_LESSON]:
    "videoLessonLimit",

  [SUBSCRIPTION_FEATURES.HOME_HELPER]:
    "homeHelperLimit",
});


/**
 * Default error messages used throughout
 * the subscription services.
 */
export const SUBSCRIPTION_MESSAGES = Object.freeze({
  USER_NOT_FOUND:
    "User not found.",

  STUDENT_NOT_FOUND:
    "Student not found.",

  ACCOUNT_NOT_FOUND:
    "Account not found.",

  SUBSCRIPTION_NOT_FOUND:
    "No active subscription found.",

  SUBSCRIPTION_INACTIVE:
    "Subscription is inactive, please re-activate.",

  SUBSCRIPTION_EXPIRED:
    "Subscription has expired, please re-active your plan or upgrade to another plan.",

  FEATURE_NOT_ALLOWED:
    "You are not subscribed for this feature, please upgrade to use feature.",

  FEATURE_LIMIT_REACHED:
    "You have reached your subscription limit for this feature, please upgrade to use feature.",

  UNKNOWN_FEATURE:
    "Unknown subscription feature.",
});