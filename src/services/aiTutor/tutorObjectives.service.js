import { db } from "../../../lib/db.js";
import { generateTopicObjectives } from "./generateTopicObjectives.service.js";

/**
 * Ensures that a topic has Tutor lesson objectives.
 *
 * Existing objectives are always reused.
 * If none exist, objectives are generated from the topic's
 * lesson contents and saved to the database.
 *
 * @param {Object} topic
 * @returns {Promise<Array>} Ordered TopicObjective records.
 */
export async function ensureTopicObjectives(topic) {
  if (!topic?.id) {
    const error = new Error("A valid topic is required.");
    error.statusCode = 400;
    throw error;
  }

  /*
   * If objectives were already loaded by getAndValidateTopic,
   * use them immediately.
   */
  if (
    Array.isArray(topic.lessonObjectives) &&
    topic.lessonObjectives.length > 0
  ) {
    return topic.lessonObjectives;
  }

  /*
   * A topic must have lesson contents because lesson contents
   * are our fallback curriculum source for generating objectives.
   */
  if (
    !Array.isArray(topic.lessonContents) ||
    topic.lessonContents.length === 0
  ) {
    const error = new Error(
      "This topic does not have lesson contents from which lesson objectives can be generated."
    );

    error.statusCode = 400;

    throw error;
  }

  /*
   * Generate and save the objectives.
   */
  await generateTopicObjectives(topic);

  /*
   * Query the database again after generation.
   *
   * This ensures that the caller receives the actual records
   * persisted in the database, rather than relying on the raw
   * Gemini response.
   */
  const objectives = await db.topicObjective.findMany({
    where: {
      topicId: topic.id,
    },
    orderBy: {
      order: "asc",
    },
  });

  if (objectives.length === 0) {
    const error = new Error(
      "Unable to create lesson objectives for this topic."
    );

    error.statusCode = 500;

    throw error;
  }

  return objectives;
}