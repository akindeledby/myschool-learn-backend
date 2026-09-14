import { db } from "../../../lib/db.js";

import { verifyFlutterwavePayment } from "../../services/payment/verifyFlutterwavePayment.service.js";
import { processSuccessfulPayment } from "../../services/payment/processSuccessfulPayment.service.js";
import { createCommission } from "../../services/payment/createCommission.service.js";


export async function flutterwaveWebhookController(
  req,
  res
) {
  try {
    // =====================================================
    // 1. VERIFY FLUTTERWAVE WEBHOOK SIGNATURE
    // =====================================================

    const receivedHash =
      req.headers["verif-hash"];

    if (!receivedHash) {
      console.error(
        "[Flutterwave Webhook] Missing verif-hash."
      );

      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    const expectedHash =
      process.env.FLUTTERWAVE_SECRET_HASH;

    if (!expectedHash) {
      console.error(
        "[Flutterwave Webhook] FLUTTERWAVE_SECRET_HASH is not configured."
      );

      return res.status(500).json({
        success: false,
        message:
          "Flutterwave webhook configuration is missing.",
      });
    }

    if (
      String(receivedHash) !==
      String(expectedHash)
    ) {
      console.error(
        "[Flutterwave Webhook] Invalid webhook signature."
      );

      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }


    // =====================================================
    // 2. READ WEBHOOK PAYLOAD
    // =====================================================

    const event = req.body;

    if (
      !event ||
      typeof event !== "object"
    ) {
      console.error(
        "[Flutterwave Webhook] Invalid webhook payload."
      );

      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload.",
      });
    }


    // =====================================================
    // 3. GET TRANSACTION DATA
    // =====================================================

    const webhookTransaction =
      event.data;

    if (!webhookTransaction) {
      console.error(
        "[Flutterwave Webhook] Transaction data is missing."
      );

      return res.status(400).json({
        success: false,
        message:
          "Transaction data is missing.",
      });
    }


    // =====================================================
    // 4. GET FLUTTERWAVE TRANSACTION ID
    // =====================================================

    const transactionId =
      webhookTransaction.id;

    if (
      transactionId === undefined ||
      transactionId === null ||
      transactionId === ""
    ) {
      console.error(
        "[Flutterwave Webhook] Transaction ID is missing."
      );

      return res.status(400).json({
        success: false,
        message:
          "Flutterwave transaction ID is missing.",
      });
    }


    // =====================================================
    // 5. VERIFY TRANSACTION DIRECTLY WITH FLUTTERWAVE
    // =====================================================

    const verifiedPayment =
      await verifyFlutterwavePayment(
        transactionId
      );


    // =====================================================
    // 6. ONLY PROCESS SUCCESSFUL PAYMENTS
    // =====================================================

    if (
      verifiedPayment.status !==
      "success"
    ) {
      console.log(
        `[Flutterwave Webhook] Payment ${verifiedPayment.reference} is not successful. Status: ${verifiedPayment.status}`
      );

      return res.status(200).json({
        success: true,
        message:
          "Payment is not successful.",
        status:
          verifiedPayment.status,
      });
    }


    // =====================================================
    // 7. PROCESS SUCCESSFUL PAYMENT
    // =====================================================

    const processedPayment =
      await processSuccessfulPayment({
        reference:
          verifiedPayment.reference,

        provider:
          "FLUTTERWAVE",

        paymentData:
          verifiedPayment,
      });


    // =====================================================
    // 8. FIND INTERNAL PAYMENT
    // =====================================================

    const payment =
      await db.payment.findUnique({
        where: {
          reference:
            verifiedPayment.reference,
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


    // =====================================================
    // 9. CREATE REFERRAL COMMISSION
    // =====================================================

    const commission =
      await createCommission({
        paymentId:
          payment.id,
      });


    // =====================================================
    // 10. SUCCESS
    // =====================================================

    console.log(
      `[Flutterwave Webhook] Payment processed successfully: ${verifiedPayment.reference}`
    );

    return res.status(200).json({
      success: true,

      message:
        "Flutterwave payment processed successfully.",

      reference:
        verifiedPayment.reference,

      payment:
        processedPayment,

      commission,
    });

  } catch (error) {
    console.error(
      "[Flutterwave Webhook] ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Unable to process Flutterwave webhook.",
    });
  }
}