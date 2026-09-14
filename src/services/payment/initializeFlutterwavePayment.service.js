import axios from "axios";

import { db } from "../../../lib/db.js";
import { generatePaymentReference } from "../../utils/paymentReference.js";

const FLUTTERWAVE_INITIALIZE_URL =
  "https://api.flutterwave.com/v3/payments";

/**
 * Mark a pending payment as failed.
 *
 * This should only be used when Flutterwave has explicitly rejected
 * the initialization request or returned an invalid initialization
 * response.
 *
 * Network and timeout errors should NOT mark the payment as failed
 * because the transaction may have actually been created by
 * Flutterwave.
 */
async function markPaymentFailed(reference) {
  if (!reference) {
    return;
  }

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
      "[Flutterwave Payment Status Update Error]",
      error
    );
  }
}

/**
 * Initialize a Flutterwave subscription payment.
 *
 * MySchoolLearn stores the payment internally first as PENDING.
 *
 * Flutterwave then receives the same MySchoolLearn payment reference
 * as its tx_ref.
 */
export async function initializeFlutterwavePayment({
  email,
  amount,
  accountId,
  subscriptionPlanId,
  referredByUserId,
  numberOfTerms,
  metadata = {},
}) {
  let reference = null;

  try {
    /*
     * ---------------------------------------------------------
     * Validate required fields
     * ---------------------------------------------------------
     */

    if (
      typeof email !== "string" ||
      !email.trim()
    ) {
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

    /*
     * Keep the amount in Naira.
     *
     * Flutterwave expects the amount in the currency's
     * normal unit, unlike Paystack which expects kobo.
     */
    const amountInNaira =
      Number(numericAmount.toFixed(2));

    /*
     * ---------------------------------------------------------
     * Generate MySchoolLearn payment reference
     * ---------------------------------------------------------
     *
     * This reference becomes Flutterwave's tx_ref.
     */
    reference =
      generatePaymentReference();

    /*
     * ---------------------------------------------------------
     * Create internal PENDING payment
     * ---------------------------------------------------------
     *
     * This happens BEFORE contacting Flutterwave.
     *
     * That means MySchoolLearn has its own payment record
     * even if the provider request later fails.
     */
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

        provider: "FLUTTERWAVE",

        status: "PENDING",
      },
    });

    /*
     * ---------------------------------------------------------
     * Build Flutterwave redirect URL
     * ---------------------------------------------------------
     *
     * We include the MySchoolLearn payment reference.
     *
     * Flutterwave will redirect the customer back to:
     *
     * /payment-success?reference=MSL-...
     *
     * The frontend can therefore pass the same reference
     * to:
     *
     * GET /api/verify-payment?reference=...
     */
    const FRONTEND_URL =
      process.env.FRONTEND_URL?.trim();

    if (!FRONTEND_URL) {
      await markPaymentFailed(
        reference
      );

      throw new Error(
        "FRONTEND_URL is not configured."
      );
    }

    const redirectUrl =
      `${FRONTEND_URL}/payment-success?reference=${encodeURIComponent(
        reference
      )}`;

    /*
     * ---------------------------------------------------------
     * Build Flutterwave metadata
     * ---------------------------------------------------------
     *
     * We preserve the metadata supplied by the common
     * payment initialization service.
     *
     * The internal reference and important payment identifiers
     * are also explicitly included.
     */
    const flutterwaveMetadata = {
      ...metadata,

      myschoollearnPaymentReference:
        reference,

      accountId,

      subscriptionPlanId,

      numberOfTerms: terms,

      ...(referredByUserId
        ? {
            referredByUserId,
          }
        : {}),
    };

    /*
     * ---------------------------------------------------------
     * Initialize payment with Flutterwave
     * ---------------------------------------------------------
     */
    let response;

    try {
      response = await axios.post(
        FLUTTERWAVE_INITIALIZE_URL,
        {
          /*
           * Flutterwave transaction reference.
           *
           * This MUST be the same reference stored in
           * MySchoolLearn Payment.reference.
           */
          tx_ref: reference,

          /*
           * Flutterwave receives Naira.
           */
          amount: amountInNaira,

          currency: "NGN",

          /*
           * Flutterwave redirects the customer here
           * after checkout.
           */
          redirect_url: redirectUrl,

          customer: {
            email:
              email.trim().toLowerCase(),
          },

          /*
           * Metadata is useful for tracing the payment
           * inside Flutterwave.
           */
          meta: flutterwaveMetadata,

          customizations: {
            title:
              "MySchoolLearn Subscription",

            description:
              "MySchoolLearn subscription payment",
          },
        },
        {
          headers: {
            Authorization:
              `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,

            "Content-Type":
              "application/json",
          },

          /*
           * Do not wait indefinitely for Flutterwave.
           */
          timeout: 15000,
        }
      );
    } catch (flutterwaveError) {
      /*
       * -------------------------------------------------------
       * Flutterwave explicitly rejected the request
       * -------------------------------------------------------
       *
       * If Flutterwave returned an HTTP response, we know
       * the request reached Flutterwave and was rejected.
       *
       * In this situation it is safe to mark our PENDING
       * payment as FAILED.
       */
      if (flutterwaveError.response) {
        await markPaymentFailed(
          reference
        );

        console.error(
          "[Flutterwave Initialize Error]",
          flutterwaveError.response.data
        );

        throw new Error(
          flutterwaveError.response.data?.message ||
            "Unable to initialize payment with Flutterwave."
        );
      }

      /*
       * -------------------------------------------------------
       * Network / timeout error
       * -------------------------------------------------------
       *
       * DO NOT mark the payment FAILED.
       *
       * Flutterwave may have received and created the
       * transaction even though our server did not receive
       * the response.
       */
      console.error(
        "[Flutterwave Network Error]",
        flutterwaveError.message
      );

      throw new Error(
        "Unable to confirm payment initialization with Flutterwave. Please try again."
      );
    }

    /*
     * ---------------------------------------------------------
     * Validate Flutterwave response
     * ---------------------------------------------------------
     */

    const flutterwaveData =
      response.data?.data;

    if (
      response.data?.status !== "success" ||
      !flutterwaveData
    ) {
      await markPaymentFailed(
        reference
      );

      console.error(
        "[Flutterwave Invalid Initialize Response]",
        response.data
      );

      throw new Error(
        response.data?.message ||
          "Invalid Flutterwave response."
      );
    }

    /*
     * ---------------------------------------------------------
     * Ensure Flutterwave returned a checkout link
     * ---------------------------------------------------------
     */
    if (
      typeof flutterwaveData.link !==
        "string" ||
      !flutterwaveData.link.trim()
    ) {
      await markPaymentFailed(
        reference
      );

      throw new Error(
        "Flutterwave did not return a valid checkout link."
      );
    }

    /*
     * ---------------------------------------------------------
     * Return provider-neutral payment information
     * ---------------------------------------------------------
     *
     * The frontend does not need to know whether this was
     * Paystack or Flutterwave.
     *
     * It simply redirects to authorizationUrl.
     */
    return {
      reference,

      authorizationUrl:
        flutterwaveData.link,
    };
  } catch (error) {
    console.error(
      "[initializeFlutterwavePayment]",
      error
    );

    throw new Error(
      error.message ||
        "Unable to initialize Flutterwave payment."
    );
  }
}
