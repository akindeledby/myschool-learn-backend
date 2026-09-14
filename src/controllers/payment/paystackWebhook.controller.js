import crypto from "crypto";

import { db } from "../../../lib/db.js";
import { verifyPaystackPayment } from "../../services/payment/verifyPaystackPayment.service.js";
import { processSuccessfulPayment } from "../../services/payment/processSuccessfulPayment.service.js";
import { createCommission } from "../../services/payment/createCommission.service.js";

export async function paystackWebhookController(req, res) {
  try {
    const signature =
      req.headers["x-paystack-signature"];

    if (!signature) {
      console.error(
        "[Paystack Webhook] Missing signature."
      );

      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    if (!req.rawBody) {
      console.error(
        "[Paystack Webhook] Raw request body is unavailable."
      );

      return res.status(500).json({
        success: false,
        message: "Unable to verify webhook signature.",
      });
    }

    /*
     * Paystack signs the raw request body using
     * HMAC SHA512 and the Paystack secret key.
     */
    const expectedSignature =
      crypto
        .createHmac(
          "sha512",
          process.env.PAYSTACK_SECRET_KEY
        )
        .update(req.rawBody)
        .digest("hex");

    /*
     * Use timingSafeEqual instead of directly comparing
     * the two signatures.
     */
    const receivedSignatureBuffer =
      Buffer.from(String(signature), "utf8");

    const expectedSignatureBuffer =
      Buffer.from(expectedSignature, "utf8");

    if (
      receivedSignatureBuffer.length !==
      expectedSignatureBuffer.length
    ) {
      console.error(
        "[Paystack Webhook] Invalid signature."
      );

      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    const isValidSignature =
      crypto.timingSafeEqual(
        receivedSignatureBuffer,
        expectedSignatureBuffer
      );

    if (!isValidSignature) {
      console.error(
        "[Paystack Webhook] Invalid signature."
      );

      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    const event = req.body;

    if (!event || !event.event) {
      console.error(
        "[Paystack Webhook] Invalid webhook payload."
      );

      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload.",
      });
    }

    /*
     * We are currently interested in successful
     * charge events.
     */
    if (event.event !== "charge.success") {
      /*
       * Acknowledge other Paystack events so Paystack
       * does not repeatedly retry events that MySchoolLearn
       * intentionally does not process.
       */
      return res.status(200).json({
        success: true,
        message: "Event received and ignored.",
      });
    }

    const webhookTransaction =
      event.data;

    if (!webhookTransaction) {
      console.error(
        "[Paystack Webhook] Transaction data is missing."
      );

      return res.status(400).json({
        success: false,
        message: "Transaction data is missing.",
      });
    }

    const reference =
      webhookTransaction.reference;

    if (!reference) {
      console.error(
        "[Paystack Webhook] Payment reference is missing."
      );

      return res.status(400).json({
        success: false,
        message: "Payment reference is missing.",
      });
    }

    /*
     * Do not trust the webhook payload alone.
     *
     * Re-query Paystack using our verification service.
     */
    const verifiedPayment =
      await verifyPaystackPayment(reference);

    /*
     * Only successful Paystack transactions should
     * reach the subscription activation process.
     */
    if (verifiedPayment.status !== "success") {
      console.log(
        `[Paystack Webhook] Payment ${reference} is not successful. Status: ${verifiedPayment.status}`
      );

      return res.status(200).json({
        success: true,
        message: "Payment is not successful.",
        status: verifiedPayment.status,
      });
    }

    /*
     * Verify the payment against the MySchoolLearn
     * payment record and activate/update the subscription.
     */
    const processedPayment =
      await processSuccessfulPayment({
        reference,
        provider: "PAYSTACK",
        paymentData: verifiedPayment,
      });

    /*
     * Retrieve the MySchoolLearn payment so that the
     * commission service can work with the internal
     * Payment ID.
     */
    const payment = await db.payment.findUnique({
      where: {
        reference,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!payment) {
      throw new Error(
        "MySchoolLearn payment record could not be found after successful payment processing."
      );
    }

    /*
     * Create the referral commission.
     *
     * createCommission() is idempotent because
     * Commission.paymentId is UNIQUE.
     */
    const commission =
      await createCommission({
        paymentId: payment.id,
      });

    console.log(
      `[Paystack Webhook] Payment processed successfully: ${reference}`
    );

    return res.status(200).json({
      success: true,
      message: "Paystack payment processed successfully.",
      reference,
      payment: processedPayment,
      commission,
    });
  } catch (error) {
    console.error(
      "[Paystack Webhook] ERROR:",
      error
    );

    /*
     * Return a non-2xx response for processing failures.
     *
     * This allows Paystack to retry the webhook according
     * to its retry mechanism.
     */
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to process Paystack webhook.",
    });
  }
}