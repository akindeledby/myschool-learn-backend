import { db } from "../../../lib/db.js";

/**
 * Determine subscription duration
 * from the number of terms purchased.
 */
function getSubscriptionDuration(
  numberOfTerms
) {
  switch (numberOfTerms) {
    case 1:
      return "TERM";

    case 2:
      return "BITERM";

    case 3:
      return "YEARLY";

    default:
      throw new Error(
        "Invalid number of terms selected."
      );
  }
}

/**
 * Each term represents 4 months.
 *
 * 1 term  = 4 months
 * 2 terms = 8 months
 * 3 terms = 12 months
 */
function getMonthsPurchased(
  numberOfTerms
) {
  return numberOfTerms * 4;
}

/**
 * Normalize currency values.
 */
function normalizeCurrency(
  currency
) {
  return String(currency || "")
    .trim()
    .toUpperCase();
}

/**
 * Convert provider transaction ID to BigInt.
 *
 * The database uses BigInt for both Paystack and
 * Flutterwave transaction IDs.
 */
function getTransactionId(
  transactionId
) {
  if (
    transactionId === undefined ||
    transactionId === null ||
    transactionId === ""
  ) {
    return null;
  }

  try {
    return BigInt(transactionId);
  } catch {
    throw new Error(
      "Invalid payment transaction ID."
    );
  }
}

/**
 * Process a successfully verified payment.
 *
 * This service is provider-independent.
 *
 * Paystack verification and Flutterwave verification
 * should both call this service after independently
 * confirming that the provider reports the transaction
 * as successful.
 */
export async function processSuccessfulPayment({
  reference,
  provider,
  paymentData,
}) {
  //-------------------------------------------------------
  // Basic validation
  //-------------------------------------------------------

  if (!reference) {
    throw new Error(
      "Payment reference is required."
    );
  }

  if (!provider) {
    throw new Error(
      "Payment provider is required."
    );
  }

  if (
    !["PAYSTACK", "FLUTTERWAVE"].includes(
      provider
    )
  ) {
    throw new Error(
      "Invalid payment provider."
    );
  }

  if (!paymentData) {
    throw new Error(
      "Payment data is required."
    );
  }

  //-------------------------------------------------------
  // Validate successful provider transaction
  //-------------------------------------------------------

  if (
    paymentData.status !==
    "success"
  ) {
    throw new Error(
      "Payment was not successful."
    );
  }

  //-------------------------------------------------------
  // Validate payment reference
  //-------------------------------------------------------

  if (
    !paymentData.reference ||
    paymentData.reference !==
      reference
  ) {
    throw new Error(
      "Payment reference mismatch."
    );
  }

  //-------------------------------------------------------
  // Find payment created by MySchoolLearn
  //-------------------------------------------------------

  const pendingPayment =
    await db.payment.findUnique({
      where: {
        reference,
      },

      include: {
        account: true,
        subscriptionPlan: true,
      },
    });

  if (!pendingPayment) {
    throw new Error(
      "Payment reference was not initiated by MySchoolLearn."
    );
  }

  //-------------------------------------------------------
  // Verify provider
  //-------------------------------------------------------

  if (
    pendingPayment.provider !==
    provider
  ) {
    throw new Error(
      "Payment provider does not match the recorded payment."
    );
  }

  //-------------------------------------------------------
  // Already processed
  //-------------------------------------------------------

  if (
    pendingPayment.status ===
    "SUCCESS"
  ) {
    return {
      success: true,

      alreadyProcessed: true,

      subscriptionId:
        pendingPayment.subscriptionId,
    };
  }

  //-------------------------------------------------------
  // Only PENDING payments can be processed
  //-------------------------------------------------------

  if (
    pendingPayment.status !==
    "PENDING"
  ) {
    throw new Error(
      `Payment cannot be processed because its current status is ${pendingPayment.status}.`
    );
  }

  //-------------------------------------------------------
  // Validate account
  //-------------------------------------------------------

  if (!pendingPayment.account) {
    throw new Error(
      "Payment account could not be found."
    );
  }

  //-------------------------------------------------------
  // Validate subscription plan
  //-------------------------------------------------------

  if (
    !pendingPayment.subscriptionPlan
  ) {
    throw new Error(
      "Subscription plan associated with this payment could not be found."
    );
  }

  //-------------------------------------------------------
  // Validate currency
  //-------------------------------------------------------

  const expectedCurrency =
    normalizeCurrency(
      pendingPayment.currency
    );

  const receivedCurrency =
    normalizeCurrency(
      paymentData.currency
    );

  if (
    !expectedCurrency ||
    !receivedCurrency ||
    receivedCurrency !==
      expectedCurrency
  ) {
    throw new Error(
      "Payment currency does not match the expected currency."
    );
  }

  //-------------------------------------------------------
  // Validate payment amount
  //-------------------------------------------------------
  //
  // IMPORTANT:
  //
  // MySchoolLearn stores payment.amount in Naira.
  //
  // Paystack verification returns amount in Kobo.
  //
  // Flutterwave verification returns amount in Naira.
  //
  //-------------------------------------------------------

  const expectedAmountNaira =
    Number(
      pendingPayment.amount
    );

  let receivedAmountNaira;

  if (
    provider === "PAYSTACK"
  ) {
    const receivedAmountKobo =
      Number(
        paymentData.amount
      );

    if (
      !Number.isSafeInteger(
        receivedAmountKobo
      ) ||
      receivedAmountKobo <= 0
    ) {
      throw new Error(
        "Invalid Paystack payment amount."
      );
    }

    receivedAmountNaira =
      receivedAmountKobo / 100;

  } else {
    receivedAmountNaira =
      Number(
        paymentData.amount
      );

    if (
      !Number.isFinite(
        receivedAmountNaira
      ) ||
      receivedAmountNaira <= 0
    ) {
      throw new Error(
        "Invalid Flutterwave payment amount."
      );
    }
  }

  //-------------------------------------------------------
  // Compare amounts
  //-------------------------------------------------------

  const expectedAmountKobo =
    Math.round(
      expectedAmountNaira * 100
    );

  const receivedAmountKobo =
    Math.round(
      receivedAmountNaira * 100
    );

  if (
    !Number.isSafeInteger(
      expectedAmountKobo
    ) ||
    !Number.isSafeInteger(
      receivedAmountKobo
    ) ||
    expectedAmountKobo !==
      receivedAmountKobo
  ) {
    console.error(
      "[Payment Amount Mismatch]",
      {
        reference,
        provider,
        expectedAmountNaira,
        receivedAmountNaira,
      }
    );

    throw new Error(
      "Payment amount does not match the expected amount."
    );
  }

  //-------------------------------------------------------
  // Validate number of terms
  //-------------------------------------------------------

  const numberOfTerms =
    Number(
      pendingPayment.numberOfTerms
    );

  if (
    ![1, 2, 3].includes(
      numberOfTerms
    )
  ) {
    throw new Error(
      "Invalid number of terms."
    );
  }

  //-------------------------------------------------------
  // Calculate subscription duration
  //-------------------------------------------------------

  const duration =
    getSubscriptionDuration(
      numberOfTerms
    );

  const monthsPurchased =
    getMonthsPurchased(
      numberOfTerms
    );

  //-------------------------------------------------------
  // Provider transaction ID
  //-------------------------------------------------------

  const transactionId =
    getTransactionId(
      paymentData.transactionId
    );

  //-------------------------------------------------------
  // Activate subscription atomically
  //-------------------------------------------------------

  const result =
    await db.$transaction(
      async (tx) => {

        //---------------------------------------------------
        // Re-read payment inside transaction
        //---------------------------------------------------

        const payment =
          await tx.payment.findUnique({
            where: {
              reference,
            },
          });

        if (!payment) {
          throw new Error(
            "Payment record no longer exists."
          );
        }

        //---------------------------------------------------
        // Protect against duplicate processing
        //---------------------------------------------------

        if (
          payment.status ===
          "SUCCESS"
        ) {
          return {
            alreadyProcessed: true,

            subscriptionId:
              payment.subscriptionId,
          };
        }

        //---------------------------------------------------
        // Only PENDING payments continue
        //---------------------------------------------------

        if (
          payment.status !==
          "PENDING"
        ) {
          throw new Error(
            `Payment cannot be processed because its current status is ${payment.status}.`
          );
        }

        //---------------------------------------------------
        // Prevent duplicate provider transaction IDs
        //---------------------------------------------------

        if (transactionId) {

          const existingTransaction =
            provider ===
            "PAYSTACK"
              ? await tx.payment.findFirst({
                  where: {
                    paystackTransactionId:
                      transactionId,

                    NOT: {
                      reference,
                    },
                  },

                  select: {
                    id: true,
                    reference: true,
                  },
                })
              : await tx.payment.findFirst({
                  where: {
                    flutterwaveTransactionId:
                      transactionId,

                    NOT: {
                      reference,
                    },
                  },

                  select: {
                    id: true,
                    reference: true,
                  },
                });

          if (existingTransaction) {
            throw new Error(
              `This ${provider} transaction has already been processed.`
            );
          }
        }

        //---------------------------------------------------
        // Current time
        //---------------------------------------------------

        const now =
          new Date();

        //---------------------------------------------------
        // Find current subscription
        //---------------------------------------------------

        const existingSubscription =
          await tx.subscription.findUnique({
            where: {
              accountId:
                payment.accountId,
            },
          });

        //---------------------------------------------------
        // Determine subscription start
        //---------------------------------------------------

        let startsAt =
          now;

        if (
          existingSubscription &&
          existingSubscription.endsAt &&
          existingSubscription.endsAt >
            now &&
          !existingSubscription.isLifetime
        ) {
          startsAt =
            new Date(
              existingSubscription.endsAt
            );
        }

        //---------------------------------------------------
        // Determine subscription end
        //---------------------------------------------------

        const endsAt =
          new Date(startsAt);

        endsAt.setMonth(
          endsAt.getMonth() +
            monthsPurchased
        );

        //---------------------------------------------------
        // Create or extend subscription
        //---------------------------------------------------

        let subscription;

        if (
          existingSubscription
        ) {

          subscription =
            await tx.subscription.update({
              where: {
                accountId:
                  payment.accountId,
              },

              data: {
                subscriptionPlanId:
                  payment.subscriptionPlanId,

                status:
                  "ACTIVE",

                duration,

                startsAt,

                endsAt,

                amountPaid: {
                  increment:
                    payment.amount,
                },

                numberOfTerms: {
                  increment:
                    numberOfTerms,
                },

                isLifetime:
                  false,
              },
            });

        } else {

          subscription =
            await tx.subscription.create({
              data: {
                accountId:
                  payment.accountId,

                subscriptionPlanId:
                  payment.subscriptionPlanId,

                status:
                  "ACTIVE",

                duration,

                startsAt,

                endsAt,

                amountPaid:
                  payment.amount,

                numberOfTerms,

                isLifetime:
                  false,
              },
            });
        }

        //---------------------------------------------------
        // Prepare payment update
        //---------------------------------------------------

        const paymentUpdate = {
          subscriptionId:
            subscription.id,

          status:
            "SUCCESS",

          paidAt:
            paymentData.paidAt
              ? new Date(
                  paymentData.paidAt
                )
              : now,
        };

        //---------------------------------------------------
        // Store provider transaction ID
        //---------------------------------------------------

        if (
          transactionId &&
          provider === "PAYSTACK"
        ) {
          paymentUpdate.paystackTransactionId =
            transactionId;
        }

        if (
          transactionId &&
          provider === "FLUTTERWAVE"
        ) {
          paymentUpdate.flutterwaveTransactionId =
            transactionId;
        }

        //---------------------------------------------------
        // Mark payment as successful
        //---------------------------------------------------

        await tx.payment.update({
          where: {
            reference,
          },

          data:
            paymentUpdate,
        });

        return {
          alreadyProcessed:
            false,

          subscriptionId:
            subscription.id,
        };
      }
    );

  //-------------------------------------------------------
  // Final response
  //-------------------------------------------------------

  return {
    success: true,

    alreadyProcessed:
      result.alreadyProcessed,

    subscriptionId:
      result.subscriptionId,
  };
}