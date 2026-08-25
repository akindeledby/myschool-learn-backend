import { activateSubscription } from "../../services/payment/activateSubscription.service.js";

const PAYSTACK_VERIFY_URL =
  "https://api.paystack.co/transaction/verify";

export async function verifySubscriptionPayment(
  req,
  res
) {
  try {
    //-------------------------------------------------------
    // Get payment reference
    //-------------------------------------------------------

    const rawReference = req.query.reference;

    if (
      typeof rawReference !== "string" ||
      !rawReference.trim()
    ) {
      return res.status(400).json({
        success: false,
        status: "INVALID_REFERENCE",
        message:
          "Payment reference is required.",
      });
    }

    const reference =
      rawReference.trim();

    //-------------------------------------------------------
    // Validate Paystack secret key
    //-------------------------------------------------------

    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error(
        "[verifySubscriptionPayment] PAYSTACK_SECRET_KEY is not configured."
      );

      return res.status(500).json({
        success: false,
        status: "CONFIGURATION_ERROR",
        message:
          "Payment service is not properly configured.",
      });
    }

    //-------------------------------------------------------
    // Verify transaction directly with Paystack
    //-------------------------------------------------------

    const response = await fetch(
      `${PAYSTACK_VERIFY_URL}/${encodeURIComponent(
        reference
      )}`,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

          "Content-Type":
            "application/json",
        },
      }
    );

    //-------------------------------------------------------
    // Parse Paystack response safely
    //-------------------------------------------------------

    let result;

    try {
      result = await response.json();
    } catch {
      return res.status(502).json({
        success: false,
        status: "PAYSTACK_ERROR",
        message:
          "Invalid response received from Paystack.",
      });
    }

    //-------------------------------------------------------
    // Check Paystack API response
    //-------------------------------------------------------

    if (
      !response.ok ||
      !result?.status
    ) {
      console.error(
        "[verifySubscriptionPayment] Paystack verification failed:",
        result
      );

      return res.status(400).json({
        success: false,
        status: "VERIFICATION_FAILED",
        message:
          result?.message ||
          "Unable to verify payment.",
      });
    }

    //-------------------------------------------------------
    // Make sure transaction data exists
    //-------------------------------------------------------

    const paymentData =
      result.data;

    if (!paymentData) {
      return res.status(502).json({
        success: false,
        status: "INVALID_PAYMENT_DATA",
        message:
          "Paystack did not return valid payment data.",
      });
    }

    const role = paymentData?.metadata?.role;

    //-------------------------------------------------------
    // Make sure Paystack returned the same reference
    //-------------------------------------------------------

    if (
      paymentData.reference !==
      reference
    ) {
      console.error(
        "[verifySubscriptionPayment] Payment reference mismatch.",
        {
          requestedReference: reference,
          returnedReference:
            paymentData.reference,
        }
      );

      return res.status(400).json({
        success: false,
        status: "REFERENCE_MISMATCH",
        message:
          "Payment reference could not be verified.",
      });
    }

    //-------------------------------------------------------
    // Check transaction status
    //-------------------------------------------------------

    if (
      paymentData.status !==
      "success"
    ) {
      return res.status(400).json({
        success: false,
        status:
          paymentData.status ||
          "UNKNOWN",
        message:
          "Payment has not been completed successfully.",
      });
    }

    const activation =
      await activateSubscription({
        reference,
        paymentData,
      });

    //-------------------------------------------------------
    // Payment was already processed
    //-------------------------------------------------------

    if (
      activation.alreadyProcessed
    ) {
      return res.status(200).json({
        success: true,
        status: "ALREADY_PROCESSED",
        message:
          "Payment has already been processed.",
        subscriptionId:
          activation.subscriptionId,
      });
    }

    //-------------------------------------------------------
    // Subscription successfully activated
    //-------------------------------------------------------

    return res.status(200).json({
      success: true,
      status: "SUCCESS",
      message:
        "Subscription activated successfully.",
      subscriptionId: activation.subscriptionId,
      role,
    });

  } catch (error) {
    console.error(
      "[verifySubscriptionPayment]",
      error
    );

    //-------------------------------------------------------
    // Handle known payment validation errors
    //-------------------------------------------------------

    const knownErrors = [
      "Payment reference is required.",
      "Payment was not successful.",
      "Payment reference mismatch.",
      "Payment reference was not initiated by MySchoolLearn.",
      "Payment currency does not match the expected currency.",
      "Payment amount does not match the expected amount.",
      "Subscription plan not found.",
      "Invalid number of terms.",
    ];

    if (
      knownErrors.includes(
        error.message
      )
    ) {
      return res.status(400).json({
        success: false,
        status: "PAYMENT_VALIDATION_FAILED",
        message: error.message,
      });
    }

    //-------------------------------------------------------
    // Unexpected server error
    //-------------------------------------------------------

    return res.status(500).json({
      success: false,
      status: "SERVER_ERROR",
      message:
        error.message ||
        "Failed to verify payment.",
    });
  }
}


// import { activateSubscription } from "../../services/payment/activateSubscription.service.js";

// export async function verifySubscriptionPayment(
//   req,
//   res
// ) {
//   try {
//     const { reference } = req.query;

//     if (!reference) {
//       return res.status(400).json({
//         success: false,
//         message: "Payment reference is required.",
//       });
//     }

//     //-------------------------------------------------------
//     // Verify transaction with Paystack
//     //-------------------------------------------------------

//     const response = await fetch(
//       `https://api.paystack.co/transaction/verify/${reference}`,
//       {
//         method: "GET",
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const result = await response.json();

//     if (!response.ok || !result.status) {
//       return res.status(400).json({
//         success: false,
//         message:
//           result.message ||
//           "Unable to verify payment.",
//       });
//     }

//     //-------------------------------------------------------
//     // Ensure payment succeeded
//     //-------------------------------------------------------

//     const paymentData = result.data;

//     if (paymentData.status !== "success") {
//       return res.status(400).json({
//         success: false,
//         message: "Payment was not successful.",
//       });
//     }

//     //-------------------------------------------------------
//     // Read metadata
//     //-------------------------------------------------------

//     const metadata = paymentData.metadata || {};

//     const accountId =
//       metadata.accountId;

//     const subscriptionPlanId =
//       metadata.subscriptionPlanId;

//     const numberOfTerms =
//       Number(metadata.numberOfTerms || 1);

//     if (!accountId || !subscriptionPlanId) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid payment metadata.",
//       });
//     }

//     //-------------------------------------------------------
//     // Activate subscription
//     //-------------------------------------------------------

//     const activation =
//       await activateSubscription({
//         accountId,
//         subscriptionPlanId,
//         paymentData,
//         numberOfTerms,
//       });

//     if (activation.alreadyProcessed) {
//       return res.status(200).json({
//         success: true,
//         message:
//           "Payment has already been processed.",
//       });
//     }

//     //-------------------------------------------------------
//     // Success
//     //-------------------------------------------------------

//     return res.status(200).json({
//       success: true,
//       message: "Subscription activated successfully.",
//       role: metadata.role,
//     });

//   } catch (error) {
//     console.error(error);

//     return res.status(500).json({
//       success: false,
//       message:
//         error.message ||
//         "Failed to verify payment.",
//     });
//   }
// }