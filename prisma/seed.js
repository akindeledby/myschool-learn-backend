import { db } from "../lib/db.js";

import {
  seedSubscriptionPlans,
} from "./seeders/seedSubscriptionPlans.js";

import {
  seedAchievementDefinitions,
} from "./seeders/seedAchievementDefinitions.js";

import {
  seedDailyChallenges,
} from "./seeders/seedDailyChallenges.js";

async function main() {
  console.log("🌱 Seeding database...");

  await seedSubscriptionPlans();

  await seedAchievementDefinitions();

  await seedDailyChallenges();

  console.log("✅ Database seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

// npx prisma db seed