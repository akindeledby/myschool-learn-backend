import { activateSubscription } from "../../services/payment/activateSubscription.service.js";

export async function verifySubscriptionPayment(
  req,
  res
) {
  try {
    const { reference } = req.query;

    // console.log("Reference is", reference)
    //-------------------------------------------------------
    // Validate input
    //-------------------------------------------------------

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required.",
      });
    }

    //-------------------------------------------------------
    // Verify transaction with Paystack
    //-------------------------------------------------------

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    // console.log(
    //   JSON.stringify(result, null, 2)
    // );

    if (!response.ok || !result.status) {
      return res.status(400).json({
        success: false,
        message:
          result.message ||
          "Unable to verify payment.",
      });
    }

    //-------------------------------------------------------
    // Ensure payment succeeded
    //-------------------------------------------------------

    const paymentData = result.data;

    if (paymentData.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Payment was not successful.",
      });
    }

    //-------------------------------------------------------
    // Read metadata
    //-------------------------------------------------------

    const metadata =
      paymentData.metadata || {};

    const accountId =
      metadata.accountId;

    const subscriptionPlanId =
      metadata.subscriptionPlanId;

    const numberOfTerms =
      Number(metadata.numberOfTerms || 1);

    if (!accountId || !subscriptionPlanId) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment metadata.",
      });
    }

    //-------------------------------------------------------
    // Activate subscription
    //-------------------------------------------------------

    const activation =
      await activateSubscription({
        accountId,
        subscriptionPlanId,
        paymentData,
        numberOfTerms,
      });

    if (activation.alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message:
          "Payment has already been processed.",
      });
    }

    //-------------------------------------------------------
    // Success
    //-------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Subscription activated successfully.",
      role: metadata.role,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to verify payment.",
    });
  }
}