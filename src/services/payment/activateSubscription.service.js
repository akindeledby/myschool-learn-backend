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

export async function activateSubscription({
  accountId,
  subscriptionPlanId,
  paymentData,
  numberOfTerms,
}) {
  //-------------------------------------------------------
  // Validate subscription plan
  //-------------------------------------------------------

  const plan =
    await db.subscriptionPlan.findUnique({
      where: {
        id: subscriptionPlanId,
      },
    });

  if (!plan) {
    throw new Error(
      "Subscription plan not found."
    );
  }

  //-------------------------------------------------------
  // Validate number of terms
  //-------------------------------------------------------

  if (
    ![1, 2, 3].includes(numberOfTerms)
  ) {
    throw new Error(
      "Invalid number of terms."
    );
  }

  //-------------------------------------------------------
  // Prevent duplicate processing
  //-------------------------------------------------------

  const existingPayment =
    await db.payment.findUnique({
      where: {
        reference:
          paymentData.reference,
      },
    });

  if (existingPayment) {
    return {
      success: true,
      alreadyProcessed: true,
    };
  }

  //-------------------------------------------------------
  // Calculate subscription details
  //-------------------------------------------------------

  const duration =
    getSubscriptionDuration(
      numberOfTerms
    );

  const monthsPurchased =
    numberOfTerms * 4;

  //-------------------------------------------------------
  // Transaction
  //-------------------------------------------------------

  await db.$transaction(
    async (tx) => {
      const now = new Date();

      let subscription;

      //---------------------------------------------------
      // Find existing subscription
      //---------------------------------------------------

      const existingSubscription =
        await tx.subscription.findUnique({
          where: {
            accountId,
          },
        });

      //---------------------------------------------------
      // Determine start date
      //---------------------------------------------------

      let startsAt = now;

      if (
        existingSubscription &&
        existingSubscription.endsAt &&
        existingSubscription.endsAt >
          now
      ) {
        startsAt = new Date(
          existingSubscription.endsAt
        );
      }

      //---------------------------------------------------
      // Determine end date
      //---------------------------------------------------

      const endsAt =
        new Date(startsAt);

      endsAt.setMonth(
        endsAt.getMonth() +
          monthsPurchased
      );

      //---------------------------------------------------
      // Create or update subscription
      //---------------------------------------------------

      if (existingSubscription) {
        subscription =
          await tx.subscription.update({
            where: {
              accountId,
            },
            data: {
              subscriptionPlanId,

              status: "ACTIVE",

              duration,

              startsAt,

              endsAt,

              amountPaid: {
                increment:
                  paymentData.amount /
                  100,
              },

              numberOfTerms: {
                increment:
                  numberOfTerms,
              },
            },
          });
      } else {
        subscription =
          await tx.subscription.create({
            data: {
              accountId,

              subscriptionPlanId,

              status: "ACTIVE",

              duration,

              startsAt,

              endsAt,

              amountPaid:
                paymentData.amount /
                100,

              numberOfTerms,

              isLifetime: false,
            },
          });
      }

      //---------------------------------------------------
      // Save payment history
      //---------------------------------------------------

      await tx.payment.create({
        data: {
          accountId,

          subscriptionId:
            subscription.id,

          reference:
            paymentData.reference,

          amount:
            paymentData.amount /
            100,

          numberOfTerms,

          currency:
            paymentData.currency,

          provider: "PAYSTACK",

          status: "SUCCESS",
        },
      });
    }
  );

  return {
    success: true,
    alreadyProcessed: false,
  };
}
