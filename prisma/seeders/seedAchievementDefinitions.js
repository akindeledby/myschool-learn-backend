import { db } from "../../lib/db.js";

import {
  ACHIEVEMENT_CODES,
} from "../../src/services/gamification/constants.js";


const achievements = [
  {
    code: ACHIEVEMENT_CODES.FIRST_VICTORY,
    title: "First Victory",
    description:
      "Win your first Millionaire Challenge.",
    icon: "🏆",
  },

  {
    code: ACHIEVEMENT_CODES.LEVEL5_SURVIVOR,
    title: "Level 5 Survivor",
    description:
      "Reach Level 5 in Millionaire Challenge.",
    icon: "⭐",
  },

  {
    code: ACHIEVEMENT_CODES.LEVEL10_MASTER,
    title: "Level 10 Master",
    description:
      "Reach Level 10 in Millionaire Challenge.",
    icon: "🔥",
  },

  {
    code: ACHIEVEMENT_CODES.MILLIONAIRE_CHAMPION,
    title: "Millionaire Champion",
    description:
      "Complete all 15 levels.",
    icon: "👑",
  },

  {
    code: ACHIEVEMENT_CODES.HIGH_ROLLER,
    title: "High Roller",
    description:
      "Score at least 100,000 points.",
    icon: "💰",
  },

  {
    code: ACHIEVEMENT_CODES.SPEED_DEMON,
    title: "Speed Demon",
    description:
      "Achieve at least 95% accuracy in Speed Challenge.",
    icon: "⚡",
  },

  {
    code: ACHIEVEMENT_CODES.QUESTION_MASTER,
    title: "Question Master",
    description:
      "Answer 100 questions correctly.",
    icon: "🎯",
  },

  {
    code: ACHIEVEMENT_CODES.SEVEN_DAY_STREAK,
    title: "7-Day Streak",
    description:
      "Study for seven consecutive days.",
    icon: "📅",
  },

  {
    code: ACHIEVEMENT_CODES.LEVEL10_SCHOLAR,
    title: "Level 10 Scholar",
    description:
      "Reach Account Level 10.",
    icon: "📚",
  },
];

export async function seedAchievementDefinitions() {
  for (const achievement of achievements) {
    await db.achievementDefinition.upsert({
      where: {
        code: achievement.code,
      },

      update: achievement,

      create: achievement,
    });
  }

  console.log(
    "✅ Achievement Definitions seeded."
  );
}
