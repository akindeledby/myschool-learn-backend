import { db } from "../../lib/db.js";

const challenges = [
  {
    title: "Complete One Millionaire Game",
    description:
      "Finish one Millionaire Challenge today.",
    xpReward: 100,
  },

  {
    title: "Complete One Speed Challenge",
    description:
      "Finish one Speed Challenge today.",
    xpReward: 100,
  },

  {
    title: "Earn 500 XP Today",
    description:
      "Accumulate at least 500 XP today.",
    xpReward: 150,
  },

  {
    title: "Answer 50 Questions Correctly",
    description:
      "Answer fifty questions correctly across all games.",
    xpReward: 150,
  },

  {
    title: "Play Three Games",
    description:
      "Complete any three games today.",
    xpReward: 120,
  },
];

export async function seedDailyChallenges() {
  for (const challenge of challenges) {
    await db.dailyChallenge.upsert({
      where: {
        title: challenge.title,
      },

      update: {},

      create: challenge,
    });
  }

  console.log(
    "✅ Daily Challenges seeded."
  );
}
