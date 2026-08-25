import { db } from "../../lib/db.js";

export async function getActiveSubscription(
  accountId
) {
  return await db.subscription.findFirst({
    where: {
      accountId,

      status: "ACTIVE",

      OR: [
        {
          endsAt: null,
        },
        {
          endsAt: {
            gt: new Date(),
          },
        },
      ],
    },

    include: {
      subscriptionPlan: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}