import { updateTutorMemory } from "../../services/elevenLabs/tutorMemory.service.js";
import { generateConversationSummary } from "../../services/elevenLabs/tutorSessionSummary.service.js";
import { updateTopicProgress } from "../../services/elevenLabs/topicProgress.service.js";
import { generateLearningInsights } from "../../services/elevenLabs/learningInsights.service.js";
import { updateLearningProfile } from "../../services/elevenLabs/learningProfile.service.js";
import { checkAchievements } from "../../services/elevenLabs/achievement.service.js";


/**
 * Background Tutor task exports.
 *
 * This file acts as a central entry point for the background
 * intelligence tasks used after an AI Tutor response has
 * finished streaming.
 *
 * The actual implementations remain in their individual
 * service files.
 *
 * This keeps streamTutorLesson.service.js clean and also
 * allows the normal Tutor chat and curriculum Tutor lesson
 * to reuse the same intelligence services.
 */

export {
  updateTutorMemory,
  generateConversationSummary,
  updateTopicProgress,
  generateLearningInsights,
  updateLearningProfile,
  checkAchievements,
};