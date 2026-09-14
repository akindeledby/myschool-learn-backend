import { db } from "../../../lib/db.js";
import { verifyPaystackPayment } from "../../services/payment/verifyPaystackPayment.service.js";
import { verifyFlutterwavePayment } from "../../services/payment/verifyFlutterwavePayment.service.js";
import { processSuccessfulPayment } from "../../services/payment/processSuccessfulPayment.service.js";
import { createCommission } from "../../services/payment/createCommission.service.js";


export async function verifyPaymentController(
  req,
  res
) {
  try {
    // -------------------------------------------------------
    // 1. AUTHENTICATED USER
    // -------------------------------------------------------

    const userId =
      req.user?.userId;

    console.log(
      "[verifyPaymentController] req.user:",
      req.user
    );

    console.log(
      "[verifyPaymentController] cookies:",
      req.headers.cookie
    );

    if (!userId) {
      return res.status(401).json({
        success: false,

        status:
          "UNAUTHENTICATED",

        message:
          "Authentication required.",
      });
    }

    const user =
      await db.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          role: true,
          accountId: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,

        status:
          "USER_NOT_FOUND",

        message:
          "Authenticated user was not found.",
      });
    }


    // -------------------------------------------------------
    // 2. GET PAYMENT REFERENCE
    // -------------------------------------------------------

    const rawReference =
      req.query.reference;

    if (
      typeof rawReference !==
        "string" ||
      !rawReference.trim()
    ) {
      return res.status(400).json({
        success: false,

        status:
          "INVALID_REFERENCE",

        message:
          "Payment reference is required.",
      });
    }

    const reference =
      rawReference.trim();


    // -------------------------------------------------------
    // 3. OPTIONAL FLUTTERWAVE TRANSACTION ID
    // -------------------------------------------------------
    //
    // Flutterwave Standard redirects the customer with:
    //
    // ?status=successful
    // &tx_ref=...
    // &transaction_id=...
    //
    // We use transaction_id when it is available.
    //
    // Paystack does not need this because Paystack can
    // verify directly using the payment reference.
    // -------------------------------------------------------

    const rawTransactionId =
      req.query.transaction_id;

    let transactionId =
      null;

    if (
      rawTransactionId !==
        undefined &&
      rawTransactionId !==
        null &&
      String(rawTransactionId).trim()
    ) {
      transactionId =
        String(
          rawTransactionId
        ).trim();

      if (
        !/^\d+$/.test(
          transactionId
        )
      ) {
        return res.status(400).json({
          success: false,

          status:
            "INVALID_FLUTTERWAVE_TRANSACTION_ID",

          message:
            "Invalid Flutterwave transaction ID.",
        });
      }
    }


    // -------------------------------------------------------
    // 4. FIND INTERNAL PAYMENT
    // -------------------------------------------------------

    const existingPayment =
      await db.payment.findUnique({
        where: {
          reference,
        },

        select: {
          id: true,

          reference: true,

          provider: true,

          status: true,

          accountId: true,

          subscriptionPlanId: true,

          flutterwaveTransactionId: true,

          paystackTransactionId: true,
        },
      });

    if (!existingPayment) {
      return res.status(404).json({
        success: false,

        status:
          "PAYMENT_NOT_FOUND",

        message:
          "Payment reference was not found.",
      });
    }


    // -------------------------------------------------------
    // 5. VERIFY PAYMENT BELONGS TO AUTHENTICATED ACCOUNT
    // -------------------------------------------------------
    //
    // This is important.
    //
    // Someone who somehow obtains a payment reference should
    // not be able to use the verification endpoint to inspect
    // or process another user's payment.
    // -------------------------------------------------------

    if (
      !existingPayment.accountId ||
      existingPayment.accountId !==
        user.accountId
    ) {
      return res.status(403).json({
        success: false,

        status:
          "PAYMENT_ACCESS_DENIED",

        message:
          "You are not authorized to verify this payment.",
      });
    }


    // -------------------------------------------------------
    // 6. DETERMINE PROVIDER
    // -------------------------------------------------------

    const provider =
      existingPayment.provider;

    if (
      provider !==
        "PAYSTACK" &&
      provider !==
        "FLUTTERWAVE"
    ) {
      console.error(
        "[verifyPaymentController] Unsupported payment provider:",
        provider
      );

      return res.status(400).json({
        success: false,

        status:
          "UNSUPPORTED_PROVIDER",

        message:
          "The payment provider is not supported.",
      });
    }


    // -------------------------------------------------------
    // 7. ALREADY SUCCESSFUL
    // -------------------------------------------------------
    //
    // This is deliberately checked before calling the
    // provider again.
    //
    // If the webhook already processed the payment,
    // the frontend does not need to process it again.
    //
    // createCommission() is idempotent, so calling it here
    // is safe and can recover a commission if one was not
    // created during webhook processing.
    // -------------------------------------------------------

    if (
      existingPayment.status ===
      "SUCCESS"
    ) {
      const commission =
        await createCommission({
          paymentId:
            existingPayment.id,
        });

      return res.status(200).json({
        success: true,

        status:
          "ALREADY_PROCESSED",

        message:
          "Payment has already been processed.",

        reference,

        provider,

        role:
          user.role,

        subscriptionId:
          null,

        commission,
      });
    }


    // -------------------------------------------------------
    // 8. VERIFY WITH THE CORRECT PROVIDER
    // -------------------------------------------------------

    let verifiedPayment;


    // =======================================================
    // PAYSTACK
    // =======================================================

    if (
      provider ===
      "PAYSTACK"
    ) {
      verifiedPayment =
        await verifyPaystackPayment(
          reference
        );
    }


    // =======================================================
    // FLUTTERWAVE
    // =======================================================

    if (
      provider ===
      "FLUTTERWAVE"
    ) {
      /*
       * Priority 1:
       *
       * Use transaction_id returned by the Flutterwave
       * redirect.
       */
      const verificationTransactionId =
        transactionId ||
        (
          existingPayment
            .flutterwaveTransactionId
            ? String(
                existingPayment
                  .flutterwaveTransactionId
              )
            : null
        );

      if (
        !verificationTransactionId
      ) {
        return res.status(202).json({
          success: false,

          status:
            "PAYMENT_PROCESSING",

          message:
            "Your payment is still being confirmed. Please wait a moment and try again.",

          reference,

          provider,

          role:
            user.role,
        });
      }

      verifiedPayment =
        await verifyFlutterwavePayment(
          verificationTransactionId
        );
    }


    // -------------------------------------------------------
    // 9. VERIFY INTERNAL REFERENCE MATCHES PROVIDER
    // -------------------------------------------------------
    //
    // This is critical.
    //
    // We must not process a Flutterwave transaction simply
    // because it is successful.
    //
    // Its tx_ref must be the exact MySchoolLearn reference
    // belonging to this payment.
    // -------------------------------------------------------

    if (
      verifiedPayment.reference !==
      reference
    ) {
      console.error(
        "[verifyPaymentController] Payment reference mismatch.",
        {
          requestedReference:
            reference,

          returnedReference:
            verifiedPayment.reference,

          provider,
        }
      );

      return res.status(400).json({
        success: false,

        status:
          "REFERENCE_MISMATCH",

        message:
          "Payment reference could not be verified.",
      });
    }


    // -------------------------------------------------------
    // 10. PAYMENT MUST BE SUCCESSFUL
    // -------------------------------------------------------

    if (
      verifiedPayment.status !==
      "success"
    ) {
      /*
       * Do not process the payment.
       *
       * Do not create a subscription.
       *
       * Do not create a commission.
       *
       * Most importantly, a pending payment is NOT treated
       * as a failed payment here.
       */

      return res.status(202).json({
        success: false,

        status:
          verifiedPayment.status ||
          "UNKNOWN",

        message:
          "Payment has not been completed successfully. Your payment may still be processing.",

        reference,

        provider,

        role:
          user.role,
      });
    }


    // -------------------------------------------------------
    // 11. PROCESS SUCCESSFUL PAYMENT
    // -------------------------------------------------------

    const processedPayment =
      await processSuccessfulPayment({
        reference,

        provider,

        paymentData:
          verifiedPayment,
      });


    // -------------------------------------------------------
    // 12. GET UPDATED INTERNAL PAYMENT
    // -------------------------------------------------------

    const payment =
      await db.payment.findUnique({
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


    // -------------------------------------------------------
    // 13. CREATE REFERRAL COMMISSION
    // -------------------------------------------------------

    const commission =
      await createCommission({
        paymentId:
          payment.id,
      });


    // -------------------------------------------------------
    // 14. SUCCESS
    // -------------------------------------------------------

    return res.status(200).json({
      success: true,

      status:
        "SUCCESS",

      message:
        "Payment verified and subscription activated successfully.",

      reference,

      provider,

      role:
        user.role,

      subscriptionId:
        processedPayment
          .subscriptionId,

      payment:
        processedPayment,

      commission,
    });

  } catch (error) {
    console.error(
      "[verifyPaymentController] ERROR:",
      error
    );


    // -------------------------------------------------------
    // KNOWN VALIDATION ERRORS
    // -------------------------------------------------------

    const knownErrors = [
      "Payment reference is required.",
      "Payment was not successful.",
      "Payment reference mismatch.",
      "Payment reference was not initiated by MySchoolLearn.",
      "Payment currency does not match the expected currency.",
      "Payment amount does not match the expected amount.",
      "Subscription plan not found.",
      "Invalid number of terms.",
      "Payment not found.",
      "Invalid payment amount.",
      "Invalid payment provider.",
      "Payment provider mismatch.",
      "Flutterwave transaction ID is required.",
      "Invalid Flutterwave transaction ID.",
    ];


    if (
      knownErrors.includes(
        error.message
      )
    ) {
      return res.status(400).json({
        success: false,

        status:
          "PAYMENT_VALIDATION_FAILED",

        message:
          error.message,
      });
    }


    // -------------------------------------------------------
    // UNEXPECTED SERVER ERROR
    // -------------------------------------------------------

    return res.status(500).json({
      success: false,

      status:
        "SERVER_ERROR",

      message:
        error.message ||
        "Failed to verify payment.",
    });
  }
}
