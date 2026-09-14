import axios from "axios";
import { db } from "../../../lib/db.js";
import { generatePaymentReference } from "../../utils/paymentReference.js";

const PAYSTACK_INITIALIZE_URL =
  "https://api.paystack.co/transaction/initialize";

async function markPaymentFailed(reference) {
  if (!reference) return;

  try {
    await db.payment.updateMany({
      where: {
        reference,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
      },
    });
  } catch (error) {
    console.error(
      "[Payment Status Update Error]",
      error
    );
  }
}

export async function initializePaystackPayment({
  email,
  amount,
  accountId,
  subscriptionPlanId,
  numberOfTerms,
  referredByUserId,
  metadata = {},
}) {
  let reference = null;

  try {
    //-------------------------------------------------------
    // Validate input
    //-------------------------------------------------------

    if (!email || !email.trim()) {
      throw new Error(
        "Customer email is required."
      );
    }

    if (!accountId) {
      throw new Error(
        "Account ID is required."
      );
    }

    if (!subscriptionPlanId) {
      throw new Error(
        "Subscription plan ID is required."
      );
    }

    const terms = Number(numberOfTerms);

    if (![1, 2, 3].includes(terms)) {
      throw new Error(
        "Invalid number of terms."
      );
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      throw new Error(
        "Invalid payment amount."
      );
    }

    //-------------------------------------------------------
    // Normalize amount
    //-------------------------------------------------------

    const amountInNaira =
      Number(numericAmount.toFixed(2));

    const amountInKobo =
      Math.round(amountInNaira * 100);

    if (
      !Number.isSafeInteger(amountInKobo) ||
      amountInKobo <= 0
    ) {
      throw new Error(
        "Invalid payment amount."
      );
    }

    //-------------------------------------------------------
    // Generate payment reference
    //-------------------------------------------------------

    reference =
      generatePaymentReference();

    //-------------------------------------------------------
    // Create PENDING payment
    //-------------------------------------------------------

    await db.payment.create({
      data: {
        accountId,

        referredByUserId:
          referredByUserId || null,

        subscriptionPlanId,

        reference,

        amount: amountInNaira,

        numberOfTerms: terms,

        currency: "NGN",

        provider: "PAYSTACK",

        status: "PENDING",
      },
    });

    //-------------------------------------------------------
    // Initialize transaction with Paystack
    //-------------------------------------------------------

    let response;

    try {
      response = await axios.post(
        PAYSTACK_INITIALIZE_URL,
        {
          email:
            email.trim().toLowerCase(),

          amount: amountInKobo,

          reference,

          currency: "NGN",

          metadata,

          callback_url:
            `${process.env.FRONTEND_URL}/payment-success`,
        },
        {
          headers: {
            Authorization:
              `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

            "Content-Type":
              "application/json",
          },

          timeout: 15000,
        }
      );
    } catch (paystackError) {
      //-----------------------------------------------------
      // Paystack explicitly rejected the request
      //-----------------------------------------------------

      if (paystackError.response) {
        await markPaymentFailed(
          reference
        );

        console.error(
          "[Paystack Initialize Error]",
          paystackError.response.data
        );

        throw new Error(
          paystackError.response.data?.message ||
            "Unable to initialize payment."
        );
      }

      //-----------------------------------------------------
      // Network / timeout error
      //-----------------------------------------------------
      // IMPORTANT:
      //
      // We deliberately DO NOT mark the payment as FAILED.
      //
      // Paystack may have successfully created the
      // transaction even though our server did not receive
      // the response.
      //
      // The payment remains PENDING and can later be checked
      // through Paystack verification/webhook handling.

      console.error(
        "[Paystack Network Error]",
        paystackError.message
      );

      throw new Error(
        "Unable to confirm payment initialization with Paystack. Please try again."
      );
    }

    //-------------------------------------------------------
    // Validate Paystack response
    //-------------------------------------------------------

    const paystackData =
      response.data?.data;

    if (
      !response.data?.status ||
      !paystackData
    ) {
      await markPaymentFailed(
        reference
      );

      throw new Error(
        response.data?.message ||
          "Invalid Paystack response."
      );
    }

    //-------------------------------------------------------
    // Verify reference
    //-------------------------------------------------------

    if (
      paystackData.reference !==
      reference
    ) {
      await markPaymentFailed(
        reference
      );

      throw new Error(
        "Paystack returned an unexpected payment reference."
      );
    }

    //-------------------------------------------------------
    // Validate checkout information
    //-------------------------------------------------------

    if (
      !paystackData.authorization_url ||
      !paystackData.access_code
    ) {
      await markPaymentFailed(
        reference
      );

      throw new Error(
        "Paystack did not return valid checkout information."
      );
    }

    //-------------------------------------------------------
    // Success
    //-------------------------------------------------------

    return {
      reference,

      accessCode:
        paystackData.access_code,

      authorizationUrl:
        paystackData.authorization_url,
    };

  } catch (error) {
    console.error(
      "[initializePaystackPayment]",
      error
    );

    //-------------------------------------------------------
    // IMPORTANT:
    //
    // Do NOT automatically mark the payment as FAILED here.
    //
    // Explicit Paystack failures and invalid responses
    // already call markPaymentFailed() above.
    //
    // Network/timeout errors intentionally leave the payment
    // PENDING because Paystack may have created the payment.
    //-------------------------------------------------------

    throw new Error(
      error.message ||
        "Unable to initialize payment."
    );
  }
}