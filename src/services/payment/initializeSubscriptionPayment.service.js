import { db } from "../../../lib/db.js";

import {
  initializePaystackPayment,
} from "./initializePaystackPayment.service.js";

import {
  initializeFlutterwavePayment,
} from "./initializeFlutterwavePayment.service.js";

export async function initializeSubscriptionPayment({
  userId,
  email,
  amount,
  accountId,
  subscriptionPlanId,
  numberOfTerms,
  paymentProvider,
  metadata = {},
}) {
  //---------------------------------------------------------
  // Validate payment provider
  //---------------------------------------------------------

  if (
    !["PAYSTACK", "FLUTTERWAVE"].includes(
      paymentProvider
    )
  ) {
    throw new Error(
      "Invalid payment provider."
    );
  }

  //---------------------------------------------------------
  // Validate authenticated user
  //---------------------------------------------------------

  if (!userId) {
    throw new Error(
      "Authenticated user is required."
    );
  }

  //---------------------------------------------------------
  // Validate account
  //---------------------------------------------------------

  if (!accountId) {
    throw new Error(
      "Account ID is required."
    );
  }

  //---------------------------------------------------------
  // Validate email
  //---------------------------------------------------------

  if (!email || !email.trim()) {
    throw new Error(
      "Customer email is required."
    );
  }

  //---------------------------------------------------------
  // Validate subscription plan
  //---------------------------------------------------------

  if (!subscriptionPlanId) {
    throw new Error(
      "Subscription plan ID is required."
    );
  }

  //---------------------------------------------------------
  // Validate number of terms
  //---------------------------------------------------------

  const terms = Number(numberOfTerms);

  if (![1, 2, 3].includes(terms)) {
    throw new Error(
      "Invalid number of terms."
    );
  }

  //---------------------------------------------------------
  // Validate amount
  //---------------------------------------------------------

  const numericAmount = Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      "Invalid payment amount."
    );
  }

  //---------------------------------------------------------
  // Get authenticated user
  //---------------------------------------------------------
  //
  // IMPORTANT:
  //
  // The frontend does NOT tell us who the referrer is.
  //
  // We get invitedById directly from the authenticated user.
  //
  //---------------------------------------------------------

  const user =
    await db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        email: true,
        role: true,
        invitedById: true,
      },
    });

  if (!user) {
    throw new Error(
      "User not found."
    );
  }

  //---------------------------------------------------------
  // Verify account belongs to authenticated user
  //---------------------------------------------------------
  //
  // We do not simply trust an accountId supplied by the
  // controller. Confirm that the authenticated user actually
  // belongs to that account.
  //
  //---------------------------------------------------------

  const account =
    await db.account.findFirst({
      where: {
        id: accountId,

        users: {
          some: {
            id: user.id,
          },
        },
      },

      select: {
        id: true,
      },
    });

  if (!account) {
    throw new Error(
      "Account not found or does not belong to the authenticated user."
    );
  }

  //---------------------------------------------------------
  // Determine referral source
  //---------------------------------------------------------
  //
  // This is the authoritative referral relationship.
  //
  // User.invitedById
  //        ↓
  // Payment.referredByUserId
  //
  //---------------------------------------------------------

  const referredByUserId =
    user.invitedById || null;

  //---------------------------------------------------------
  // Build payment metadata
  //---------------------------------------------------------

  const paymentMetadata = {
    ...metadata,

    userId: user.id,

    accountId: account.id,

    subscriptionPlanId,

    numberOfTerms: terms,

    paymentProvider,

    role: user.role,

    ...(referredByUserId
      ? {
          referredByUserId,
        }
      : {}),
  };

  //---------------------------------------------------------
  // Initialize with Paystack
  //---------------------------------------------------------

  if (
    paymentProvider === "PAYSTACK"
  ) {
    return await initializePaystackPayment({
      email:
        user.email || email,

      amount:
        numericAmount,

      accountId:
        account.id,

      subscriptionPlanId,

      numberOfTerms:
        terms,

      referredByUserId,

      metadata:
        paymentMetadata,
    });
  }

  //---------------------------------------------------------
  // Initialize with Flutterwave
  //---------------------------------------------------------

  if (
    paymentProvider === "FLUTTERWAVE"
  ) {
    return await initializeFlutterwavePayment({
      email:
        user.email || email,

      amount:
        numericAmount,

      accountId:
        account.id,

      subscriptionPlanId,

      numberOfTerms:
        terms,

      referredByUserId,

      metadata:
        paymentMetadata,
    });
  }

  //---------------------------------------------------------
  // Safety fallback
  //---------------------------------------------------------

  throw new Error(
    "Unsupported payment provider."
  );
}