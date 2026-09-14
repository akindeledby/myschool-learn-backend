import axios from "axios";

const FLUTTERWAVE_VERIFY_URL =
  "https://api.flutterwave.com/v3/transactions";

/**
 * Verify a Flutterwave transaction using its transaction ID.
 *
 * Flutterwave's official verification flow requires the
 * transaction ID and returns the transaction's tx_ref,
 * amount, currency and status.
 */
export async function verifyFlutterwavePayment(
  transactionId
) {
  try {
    // ---------------------------------------------------------
    // 1. VALIDATE TRANSACTION ID
    // ---------------------------------------------------------

    if (
      transactionId === undefined ||
      transactionId === null ||
      transactionId === ""
    ) {
      throw new Error(
        "Flutterwave transaction ID is required."
      );
    }

    const normalizedTransactionId =
      String(transactionId).trim();

    if (
      !/^\d+$/.test(
        normalizedTransactionId
      )
    ) {
      throw new Error(
        "Invalid Flutterwave transaction ID."
      );
    }

    // ---------------------------------------------------------
    // 2. VERIFY TRANSACTION WITH FLUTTERWAVE
    // ---------------------------------------------------------

    const response = await axios.get(
      `${FLUTTERWAVE_VERIFY_URL}/${encodeURIComponent(
        normalizedTransactionId
      )}/verify`,
      {
        headers: {
          Authorization:
            `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,

          "Content-Type":
            "application/json",
        },

        timeout: 15000,
      }
    );

    // ---------------------------------------------------------
    // 3. VALIDATE FLUTTERWAVE RESPONSE
    // ---------------------------------------------------------

    if (
      response.data?.status !==
        "success" ||
      !response.data?.data
    ) {
      throw new Error(
        response.data?.message ||
          "Unable to verify Flutterwave payment."
      );
    }

    const payment =
      response.data.data;

    // ---------------------------------------------------------
    // 4. VALIDATE TRANSACTION ID RETURNED
    // ---------------------------------------------------------

    if (
      payment.id === undefined ||
      payment.id === null ||
      payment.id === ""
    ) {
      throw new Error(
        "Flutterwave verification response did not contain a transaction ID."
      );
    }

    const verifiedTransactionId =
      String(payment.id).trim();

    if (
      verifiedTransactionId !==
      normalizedTransactionId
    ) {
      throw new Error(
        "Flutterwave returned an unexpected transaction ID."
      );
    }

    // ---------------------------------------------------------
    // 5. VALIDATE TRANSACTION REFERENCE
    // ---------------------------------------------------------

    if (
      typeof payment.tx_ref !==
        "string" ||
      !payment.tx_ref.trim()
    ) {
      throw new Error(
        "Flutterwave verification response did not contain a transaction reference."
      );
    }

    // ---------------------------------------------------------
    // 6. NORMALIZE STATUS
    // ---------------------------------------------------------
    //
    // Flutterwave returns:
    //
    // successful
    // failed
    // pending
    //
    // Our internal payment processing expects:
    //
    // success
    //
    // for a successful transaction.
    // ---------------------------------------------------------

    const normalizedStatus =
      payment.status ===
      "successful"
        ? "success"
        : payment.status;

    // ---------------------------------------------------------
    // 7. NORMALIZE AMOUNT
    // ---------------------------------------------------------

    const normalizedAmount =
      Number(payment.amount);

    if (
      !Number.isFinite(
        normalizedAmount
      ) ||
      normalizedAmount < 0
    ) {
      throw new Error(
        "Flutterwave returned an invalid payment amount."
      );
    }

    // ---------------------------------------------------------
    // 8. RETURN NORMALIZED PAYMENT
    // ---------------------------------------------------------

    return {
      success: true,

      reference:
        payment.tx_ref.trim(),

      status:
        normalizedStatus,

      amount:
        normalizedAmount,

      currency:
        payment.currency,

      transactionId:
        payment.id,

      paidAt:
        payment.created_at ||
        null,

      gatewayResponse:
        payment.processor_response ||
        null,

      channel:
        payment.payment_type ||
        null,

      customer:
        payment.customer ||
        null,

      raw:
        payment,
    };
  } catch (error) {
    console.error(
      "[verifyFlutterwavePayment]",
      error
    );

    throw new Error(
      error.response?.data?.message ||
        error.message ||
        "Unable to verify Flutterwave payment."
    );
  }
}