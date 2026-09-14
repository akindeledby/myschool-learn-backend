import { db } from "../../../lib/db.js";

/**
 * Commission percentage for successful referred payments.
 *
 * 20 means the referrer receives 20%
 * of the successful payment amount.
 */
const COMMISSION_PERCENTAGE = 20;

/**
 * Roles that are currently eligible
 * to earn referral commissions.
 */
const COMMISSION_ELIGIBLE_ROLES = [
  "SCHOOL_ADMIN",
  "TEACHER",
  "PARENT",
  "STUDENT",
];

export async function createCommission({
  paymentId,
}) {
  try {
    if (!paymentId) {
      throw new Error("Payment ID is required.");
    }

    /*
     * Retrieve the payment together with the
     * user who referred the paying user.
     */
    const payment = await db.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        referredBy: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!payment) {
      throw new Error("Payment not found.");
    }

    /*
     * A commission can only be created after
     * the payment has been successfully processed.
     */
    if (payment.status !== "SUCCESS") {
      throw new Error(
        "Commission cannot be created for a payment that is not successful."
      );
    }

    /*
     * If the customer was not referred by another user,
     * there is no commission to create.
     */
    if (!payment.referredByUserId) {
      return {
        success: true,
        commissionCreated: false,
        alreadyExists: false,
        reason: "NO_REFERRER",
        commission: null,
      };
    }

    /*
     * Get the actual referrer User record.
     */
    const referrer = payment.referredBy;

    /*
     * Defensive protection against an inconsistent
     * referral relationship.
     */
    if (!referrer) {
      throw new Error(
        "The payment has a referrer ID, but the referrer could not be found."
      );
    }

    /*
     * Only eligible roles can earn commissions.
     */
    if (
      !COMMISSION_ELIGIBLE_ROLES.includes(
        referrer.role
      )
    ) {
      return {
        success: true,
        commissionCreated: false,
        alreadyExists: false,
        reason: "REFERRER_ROLE_NOT_ELIGIBLE",
        commission: null,
      };
    }

    /*
     * Commission.paymentId is UNIQUE in Prisma.
     *
     * This check makes repeated webhook processing
     * safely idempotent.
     */
    const existingCommission =
      await db.commission.findUnique({
        where: {
          paymentId: payment.id,
        },
      });

    if (existingCommission) {
      return {
        success: true,
        commissionCreated: false,
        alreadyExists: true,
        reason: "COMMISSION_ALREADY_EXISTS",
        commission: existingCommission,
      };
    }

    /*
     * Convert the stored payment amount to a number
     * for commission calculation.
     */
    const paymentAmount = Number(payment.amount);

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      throw new Error(
        "Invalid payment amount for commission calculation."
      );
    }

    /*
     * Calculate the referrer's commission.
     *
     * Example:
     *
     * Payment = ₦4,000
     * Commission = 20%
     *
     * ₦4,000 × 20 / 100 = ₦800
     */
    const commissionAmount =
      (paymentAmount * COMMISSION_PERCENTAGE) / 100;

    /*
     * Create the commission record.
     */
    const commission = await db.commission.create({
      data: {
        referrerUserId: referrer.id,
        paymentId: payment.id,
        referrerRole: referrer.role,
        percentage: COMMISSION_PERCENTAGE,
        paymentAmount: payment.amount,
        commissionAmount,
        currency: payment.currency,
        status: "AVAILABLE",
      },
    });

    return {
      success: true,
      commissionCreated: true,
      alreadyExists: false,
      reason: "COMMISSION_CREATED",
      commission,
    };
  } catch (error) {
    /*
     * Because Commission.paymentId is UNIQUE, two
     * simultaneous webhook requests could theoretically
     * attempt to create the same commission.
     *
     * If the second request hits the unique constraint,
     * retrieve the already-created commission and treat
     * the operation as successful and idempotent.
     */
    if (error?.code === "P2002") {
      const existingCommission =
        await db.commission.findUnique({
          where: {
            paymentId,
          },
        });

      if (existingCommission) {
        return {
          success: true,
          commissionCreated: false,
          alreadyExists: true,
          reason: "COMMISSION_ALREADY_EXISTS",
          commission: existingCommission,
        };
      }
    }

    console.error(
      "[createCommission]",
      error
    );

    throw new Error(
      error.message ||
        "Unable to create payment commission."
    );
  }
}