import { db } from "../../lib/db.js";

export async function fetchSubscriptionPlans(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const user =
      await db.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          role: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let planFilter = [];

    switch (user.role) {
      case "STUDENT":
        planFilter = [
          "FREEMIUM_INDIVIDUAL",
          "SILVER_INDIVIDUAL",
          "DIAMOND_INDIVIDUAL",
          "GOLD_INDIVIDUAL",
        ];
        break;

      case "PARENT":
        planFilter = [
          "FREEMIUM_FAMILY",
          "SILVER_FAMILY",
          "DIAMOND_FAMILY",
          "GOLD_FAMILY",
        ];
        break;

      case "SCHOOL":
        planFilter = [
          "FREEMIUM_SCHOOL",
          "SILVER_SCHOOL",
          "DIAMOND_SCHOOL",
          "GOLD_SCHOOL",
        ];
        break;

      default:
        planFilter = [];
    }

    const plans =
      await db.subscriptionPlan.findMany({
        where: {
          subscriptionPlanName: {
            in: planFilter,
          },
        },
        orderBy: {
          pricePerTerm: "asc",
        },
      });

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch plans",
    });
  }
}