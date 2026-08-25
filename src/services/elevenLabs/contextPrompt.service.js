export function formatTutorContext(
  context
) {
  return `
STUDENT MEMORY

${context.memory || "None"}

LEARNING INSIGHTS

Strongest Subject:
${context.insights?.strongestSubject || "Unknown"}

Weakest Subject:
${context.insights?.weakestSubject || "Unknown"}

Next Goal:
${context.insights?.nextGoal || "Unknown"}

Recommended Topics:
${context.insights?.recommendedTopics?.join(", ") || "None"}

TOPIC PROGRESS

${context.topicProgress
  .map(
    (topic) => `
${topic.topic}
Mastery: ${topic.masteryScore}%
`
  )
  .join("\n")}
`;
}