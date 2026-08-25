import { db } from "../../../lib/db.js";
import { initializeSubscriptionPayment } from "../../services/payment/initializeSubscriptionPayment.service.js";

export async function initializeSubscriptionPaymentController(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const {
      email,
      subscriptionPlanId,
      numberOfTerms,
    } = req.body;

    //---------------------------------------------------------
    // Validation
    //---------------------------------------------------------

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    if (!subscriptionPlanId) {
      return res.status(400).json({
        success: false,
        message: "Subscription plan is required.",
      });
    }

    if (
      !numberOfTerms ||
      ![1, 2, 3].includes(Number(numberOfTerms))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please select a valid number of terms.",
      });
    }

    //---------------------------------------------------------
    // Authenticated user
    //---------------------------------------------------------

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        account: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.account) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    //---------------------------------------------------------
    // Subscription Plan
    //---------------------------------------------------------

    const subscriptionPlan =
      await db.subscriptionPlan.findUnique({
        where: {
          id: subscriptionPlanId,
        },
      });

    if (!subscriptionPlan) {
      return res.status(404).json({
        success: false,
        message:
          "Subscription plan not found.",
      });
    }

    //---------------------------------------------------------
    // Calculate Amount
    //---------------------------------------------------------

    const terms =
      Number(numberOfTerms);

    let amount;

    if (
      terms === 3 &&
      subscriptionPlan.pricePerSession
    ) {
      amount = Number(
        subscriptionPlan.pricePerSession
      );
    } else {
      amount =
        Number(
          subscriptionPlan.pricePerTerm
        ) * terms;
    }

    //---------------------------------------------------------
    // Initialize Paystack
    //---------------------------------------------------------

    const payment =
      await initializeSubscriptionPayment({
        email,

        amount,

        metadata: {
          userId: user.id,

          accountId:
            user.account.id,

          subscriptionPlanId:
            subscriptionPlan.id,

          subscriptionPlanName:
            subscriptionPlan.subscriptionPlanName,

          numberOfTerms: terms,

          role: user.role,
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Payment initialized successfully.",
      payment,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to initialize payment.",
    });
  }
}