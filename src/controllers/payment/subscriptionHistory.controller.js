import { db } from "../../../lib/db.js";

export async function getSubscriptionsAndPaymentHistory(
  req,
  res
) {
  try {
    // ==========================================
    // 1. AUTHENTICATED USER
    // ==========================================

    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // ==========================================
    // 2. FIND USER
    // ==========================================

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
        message: "User not found.",
      });
    }

    if (!user.accountId) {
      return res.status(404).json({
        success: false,
        message:
          "No account is associated with this user.",
      });
    }

    // ==========================================
    // 3. FETCH CURRENT SUBSCRIPTION
    // ==========================================

    const subscription =
      await db.subscription.findUnique({
        where: {
          accountId: user.accountId,
        },

        select: {
          id: true,
          accountId: true,
          subscriptionPlanId: true,
          status: true,
          duration: true,
          startsAt: true,
          endsAt: true,
          numberOfTerms: true,
          amountPaid: true,
          isLifetime: true,
          createdAt: true,

          subscriptionPlan: {
            select: {
              id: true,
              subscriptionPlanName: true,
            },
          },

          payments: {
            orderBy: {
              createdAt: "desc",
            },

            select: {
              id: true,
              subscriptionId: true,
              reference: true,
              amount: true,
              numberOfTerms: true,
              currency: true,
              provider: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

    // ==========================================
    // 4. NO SUBSCRIPTION
    // ==========================================

    if (!subscription) {
      return res.status(200).json({
        success: true,

        currentSubscription: null,

        payments: [],
      });
    }

    // ==========================================
    // 5. FIND CURRENT PAYMENT
    // ==========================================

    /*
     * The current subscription may have several
     * payment records.
     *
     * We consider the most recent successful
     * payment belonging to the current subscription
     * to be the payment that established the
     * current subscription.
     */

    const successfulPayments =
      subscription.payments.filter(
        (payment) =>
          payment.status === "SUCCESS" ||
          payment.status === "COMPLETED"
      );

    const currentPayment =
      successfulPayments.length > 0
        ? successfulPayments[0]
        : null;

    // ==========================================
    // 6. FORMAT PAYMENT HISTORY
    // ==========================================

    const payments =
      subscription.payments.map(
        (payment) => ({
          id: payment.id,

          subscriptionId:
            payment.subscriptionId,

          reference:
            payment.reference,

          amount:
            Number(payment.amount),

          numberOfTerms:
            payment.numberOfTerms,

          currency:
            payment.currency,

          provider:
            payment.provider,

          status:
            payment.status,

          createdAt:
            payment.createdAt,

          isCurrent:
            currentPayment?.id ===
            payment.id,
        })
      );

    // ==========================================
    // 7. FORMAT CURRENT SUBSCRIPTION
    // ==========================================

    const currentSubscription = {
      id: subscription.id,

      accountId:
        subscription.accountId,

      subscriptionPlanId:
        subscription.subscriptionPlanId,

      planName:
        subscription.subscriptionPlan?.subscriptionPlanName ||
        "Subscription Plan",

      status:
        subscription.status,

      duration:
        subscription.duration,

      startsAt:
        subscription.startsAt,

      endsAt:
        subscription.endsAt,

      numberOfTerms:
        subscription.numberOfTerms,

      amountPaid:
        Number(subscription.amountPaid),

      isLifetime:
        subscription.isLifetime,

      createdAt:
        subscription.createdAt,

      currentPaymentId:
        currentPayment?.id || null,

      currentPaymentReference:
        currentPayment?.reference || null,

      currentPaymentDate:
        currentPayment?.createdAt || null,

      currentPaymentStatus:
        currentPayment?.status || null,

      currentPaymentProvider:
        currentPayment?.provider || null,

      currentPaymentCurrency:
        currentPayment?.currency || null,
    };

    // ==========================================
    // 8. RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,

      currentSubscription,

      payments,
    });
  } catch (error) {
    console.error(
      "Get subscription and payment history error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve subscription and payment history.",
    });
  }
}
