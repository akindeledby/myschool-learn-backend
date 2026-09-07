import { db } from "../../lib/db.js";

export async function fetchPricPageSubscriptionPlans(req, res) {
  try {
    const plans =
      await db.subscriptionPlan.findMany({
        orderBy: {
          pricePerTerm: "asc",
        },
      });

    // console.log(
    //   "🔥 Plans fetched:",
    //   plans.length
    // );

    // console.log(
    //   "🔥 Plan names:",
    //   plans.map(
    //     (plan) =>
    //       plan.subscriptionPlanName
    //   )
    // );

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error(
      "🔥 Failed to fetch subscription plans:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch subscription plans",
    });
  }
}