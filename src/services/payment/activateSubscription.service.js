import { db } from "../../../lib/db.js";

function getSubscriptionDuration(numberOfTerms) {
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

function getMonthsPurchased(numberOfTerms) {
  return numberOfTerms * 4;
}

function normalizeCurrency(currency) {
  return String(currency || "")
    .trim()
    .toUpperCase();
}

function getPaystackTransactionId(paymentData) {
  if (
    paymentData?.id === undefined ||
    paymentData?.id === null ||
    paymentData?.id === ""
  ) {
    return null;
  }

  try {
    return BigInt(paymentData.id);
  } catch {
    throw new Error(
      "Invalid Paystack transaction ID."
    );
  }
}

export async function activateSubscription({
  reference,
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

  if (!paymentData) {
    throw new Error(
      "Payment data is required."
    );
  }

  //-------------------------------------------------------
  // Validate Paystack transaction
  //-------------------------------------------------------

  if (paymentData.status !== "success") {
    throw new Error(
      "Payment was not successful."
    );
  }

  if (
    !paymentData.reference ||
    paymentData.reference !== reference
  ) {
    throw new Error(
      "Payment reference mismatch."
    );
  }

  //-------------------------------------------------------
  // Find the payment created by MySchoolLearn
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
  // Only pending payments can be activated
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

  if (!pendingPayment.subscriptionPlan) {
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
  // Validate amount
  //-------------------------------------------------------
  // Database:
  // amount = Naira
  //
  // Paystack:
  // amount = Kobo

  const expectedAmountKobo =
    Math.round(
      Number(pendingPayment.amount) *
        100
    );

  const receivedAmountKobo =
    Number(paymentData.amount);

  if (
    !Number.isSafeInteger(
      receivedAmountKobo
    ) ||
    receivedAmountKobo !==
      expectedAmountKobo
  ) {
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
  // Paystack transaction ID
  //-------------------------------------------------------

  const paystackTransactionId =
    getPaystackTransactionId(
      paymentData
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
        // Only pending payments continue
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
        // Prevent duplicate Paystack transaction IDs
        //---------------------------------------------------

        if (paystackTransactionId) {
          const existingTransaction =
            await tx.payment.findFirst({
              where: {
                paystackTransactionId,
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
              "This Paystack transaction has already been processed."
            );
          }
        }

        //---------------------------------------------------
        // Current time
        //---------------------------------------------------

        const now = new Date();

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

        let startsAt = now;

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

        if (existingSubscription) {
          subscription =
            await tx.subscription.update({
              where: {
                accountId:
                  payment.accountId,
              },

              data: {
                subscriptionPlanId:
                  payment.subscriptionPlanId,

                status: "ACTIVE",

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

                isLifetime: false,
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

                status: "ACTIVE",

                duration,

                startsAt,

                endsAt,

                amountPaid:
                  payment.amount,

                numberOfTerms,

                isLifetime: false,
              },
            });
        }

        //---------------------------------------------------
        // Mark payment as successful
        //---------------------------------------------------

        await tx.payment.update({
          where: {
            reference,
          },

          data: {
            subscriptionId:
              subscription.id,

            status: "SUCCESS",

            paidAt:
              paymentData.paid_at
                ? new Date(
                    paymentData.paid_at
                  )
                : new Date(),

            paystackTransactionId,
          },
        });

        return {
          alreadyProcessed: false,
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


// import { db } from "../../../lib/db.js";

// function getSubscriptionDuration(numberOfTerms) {
//   switch (numberOfTerms) {
//     case 1:
//       return "TERM";

//     case 2:
//       return "BITERM";

//     case 3:
//       return "YEARLY";

//     default:
//       throw new Error(
//         "Invalid number of terms selected."
//       );
//   }
// }

// export async function activateSubscription({
//   accountId,
//   subscriptionPlanId,
//   paymentData,
//   numberOfTerms,
// }) {
//   //-------------------------------------------------------
//   // Validate subscription plan
//   //-------------------------------------------------------

//   const plan =
//     await db.subscriptionPlan.findUnique({
//       where: {
//         id: subscriptionPlanId,
//       },
//     });

//   if (!plan) {
//     throw new Error(
//       "Subscription plan not found."
//     );
//   }

//   //-------------------------------------------------------
//   // Validate number of terms
//   //-------------------------------------------------------

//   if (
//     ![1, 2, 3].includes(numberOfTerms)
//   ) {
//     throw new Error(
//       "Invalid number of terms."
//     );
//   }

//   //-------------------------------------------------------
//   // Prevent duplicate processing
//   //-------------------------------------------------------

//   const existingPayment =
//     await db.payment.findUnique({
//       where: {
//         reference:
//           paymentData.reference,
//       },
//     });

//   if (existingPayment) {
//     return {
//       success: true,
//       alreadyProcessed: true,
//     };
//   }

//   //-------------------------------------------------------
//   // Calculate subscription details
//   //-------------------------------------------------------

//   const duration =
//     getSubscriptionDuration(
//       numberOfTerms
//     );

//   const monthsPurchased =
//     numberOfTerms * 4;

//   //-------------------------------------------------------
//   // Transaction
//   //-------------------------------------------------------

//   await db.$transaction(
//     async (tx) => {
//       const now = new Date();

//       let subscription;

//       //---------------------------------------------------
//       // Find existing subscription
//       //---------------------------------------------------

//       const existingSubscription =
//         await tx.subscription.findUnique({
//           where: {
//             accountId,
//           },
//         });

//       //---------------------------------------------------
//       // Determine start date
//       //---------------------------------------------------

//       let startsAt = now;

//       if (
//         existingSubscription &&
//         existingSubscription.endsAt &&
//         existingSubscription.endsAt >
//           now
//       ) {
//         startsAt = new Date(
//           existingSubscription.endsAt
//         );
//       }

//       //---------------------------------------------------
//       // Determine end date
//       //---------------------------------------------------

//       const endsAt =
//         new Date(startsAt);

//       endsAt.setMonth(
//         endsAt.getMonth() +
//           monthsPurchased
//       );

//       //---------------------------------------------------
//       // Create or update subscription
//       //---------------------------------------------------

//       if (existingSubscription) {
//         subscription =
//           await tx.subscription.update({
//             where: {
//               accountId,
//             },
//             data: {
//               subscriptionPlanId,

//               status: "ACTIVE",

//               duration,

//               startsAt,

//               endsAt,

//               amountPaid: {
//                 increment:
//                   paymentData.amount /
//                   100,
//               },

//               numberOfTerms: {
//                 increment:
//                   numberOfTerms,
//               },
//             },
//           });
//       } else {
//         subscription =
//           await tx.subscription.create({
//             data: {
//               accountId,

//               subscriptionPlanId,

//               status: "ACTIVE",

//               duration,

//               startsAt,

//               endsAt,

//               amountPaid:
//                 paymentData.amount /
//                 100,

//               numberOfTerms,

//               isLifetime: false,
//             },
//           });
//       }

//       //---------------------------------------------------
//       // Save payment history
//       //---------------------------------------------------

//       await tx.payment.create({
//         data: {
//           accountId,

//           subscriptionId:
//             subscription.id,

//           reference:
//             paymentData.reference,

//           amount:
//             paymentData.amount /
//             100,

//           numberOfTerms,

//           currency:
//             paymentData.currency,

//           provider: "PAYSTACK",

//           status: "SUCCESS",
//         },
//       });
//     }
//   );

//   return {
//     success: true,
//     alreadyProcessed: false,
//   };
// }
