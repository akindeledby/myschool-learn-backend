import crypto from "crypto";
import { activateSubscription } from "../../services/payment/activateSubscription.service.js";

export async function paystackWebhook(req, res) {
  try {
    //-------------------------------------------------------
    // Verify Paystack signature
    //-------------------------------------------------------

    const signature =
      req.headers["x-paystack-signature"];

    if (!signature) {
      return res.status(401).json({
        success: false,
        message: "Missing Paystack signature.",
      });
    }

    const hash = crypto
      .createHmac(
        "sha512",
        process.env.PAYSTACK_SECRET_KEY
      )
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== signature) {
      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    //-------------------------------------------------------
    // Event
    //-------------------------------------------------------

    const event = req.body;

    //-------------------------------------------------------
    // Ignore events we don't need
    //-------------------------------------------------------

    if (event.event !== "charge.success") {
      return res.status(200).json({
        success: true,
        message: "Webhook ignored.",
      });
    }

    //-------------------------------------------------------
    // Payment data
    //-------------------------------------------------------

    const paymentData = event.data;

    if (!paymentData?.reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is missing.",
      });
    }

    //-------------------------------------------------------
    // Activate subscription
    //-------------------------------------------------------

    const activation =
      await activateSubscription({
        reference:
          paymentData.reference,

        paymentData,
      });

    //-------------------------------------------------------
    // Already processed
    //-------------------------------------------------------

    if (activation.alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message:
          "Payment already processed.",
      });
    }

    //-------------------------------------------------------
    // Success
    //-------------------------------------------------------

    return res.status(200).json({
      success: true,
      message:
        "Webhook processed successfully.",
    });

  } catch (error) {
    console.error(
      "[Paystack Webhook Error]",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Webhook processing failed.",
    });
  }
}
