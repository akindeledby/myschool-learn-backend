import axios from "axios";

const PAYSTACK_VERIFY_URL =
  "https://api.paystack.co/transaction/verify";

export async function verifyPaystackPayment(
  reference
) {
  try {
    //-------------------------------------------------------
    // Validate reference
    //-------------------------------------------------------

    if (!reference || !reference.trim()) {
      throw new Error(
        "Payment reference is required."
      );
    }

    //-------------------------------------------------------
    // Verify transaction with Paystack
    //-------------------------------------------------------

    const response = await axios.get(
      `${PAYSTACK_VERIFY_URL}/${encodeURIComponent(
        reference.trim()
      )}`,
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

    //-------------------------------------------------------
    // Validate Paystack response
    //-------------------------------------------------------

    if (
      !response.data?.status ||
      !response.data?.data
    ) {
      throw new Error(
        response.data?.message ||
          "Unable to verify Paystack payment."
      );
    }

    const payment =
      response.data.data;

    //-------------------------------------------------------
    // Verify reference
    //-------------------------------------------------------

    if (
      payment.reference !==
      reference.trim()
    ) {
      throw new Error(
        "Paystack returned an unexpected payment reference."
      );
    }

    //-------------------------------------------------------
    // Return normalized verification result
    //-------------------------------------------------------

    return {
      success: true,

      reference:
        payment.reference,

      status:
        payment.status,

      amount:
        Number(payment.amount),

      currency:
        payment.currency,

      transactionId:
        payment.id,

      paidAt:
        payment.paid_at || null,

      gatewayResponse:
        payment.gateway_response || null,

      channel:
        payment.channel || null,

      customer:
        payment.customer || null,

      raw:
        payment,
    };

  } catch (error) {
    console.error(
      "[verifyPaystackPayment]",
      error
    );

    throw new Error(
      error.response?.data?.message ||
        error.message ||
        "Unable to verify Paystack payment."
    );
  }
}