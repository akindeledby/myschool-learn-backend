import { db } from "../../../lib/db.js";
import { initializeSubscriptionPayment } from "../../services/payment/initializeSubscriptionPayment.service.js";

export async function initializeSubscriptionPaymentController(
  req,
  res
) {
  try {
    const userId = req.user.userId;

    const {
      subscriptionPlanId,
      numberOfTerms,
    } = req.body;

    //-------------------------------------------------------
    // Validate request
    //-------------------------------------------------------

    if (!subscriptionPlanId) {
      return res.status(400).json({
        success: false,
        message: "Subscription plan is required.",
      });
    }

    const terms = Number(numberOfTerms);

    if (![1, 2, 3].includes(terms)) {
      return res.status(400).json({
        success: false,
        message:
          "Please select a valid number of terms.",
      });
    }

    //-------------------------------------------------------
    // Get authenticated user
    //-------------------------------------------------------

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

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message:
          "Your account does not have an email address.",
      });
    }

    //-------------------------------------------------------
    // Get subscription plan
    //-------------------------------------------------------

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

    //-------------------------------------------------------
    // Calculate amount SERVER SIDE
    //-------------------------------------------------------

    let amount;

    if (
      terms === 3 &&
      subscriptionPlan.pricePerSession !== null
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

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid subscription amount.",
      });
    }

    //-------------------------------------------------------
    // Initialize Paystack
    //-------------------------------------------------------

    const payment =
      await initializeSubscriptionPayment({
        email: user.email,

        amount,

        accountId:
          user.account.id,

        subscriptionPlanId:
          subscriptionPlan.id,

        numberOfTerms: terms,

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

    //-------------------------------------------------------
    // Response
    //-------------------------------------------------------

    return res.status(200).json({
      success: true,
      message:
        "Payment initialized successfully.",
      payment,
    });

  } catch (error) {
    console.error(
      "[initializeSubscriptionPaymentController]",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to initialize payment.",
    });
  }
}

