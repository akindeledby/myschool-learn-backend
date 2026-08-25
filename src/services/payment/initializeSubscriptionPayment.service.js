import axios from "axios";
import { generatePaymentReference } from "../../utils/paymentReference.js";

const PAYSTACK_INITIALIZE_URL =
  "https://api.paystack.co/transaction/initialize";

export async function initializeSubscriptionPayment({
  email,
  amount,
  metadata = {},
}) {
  try {
    const reference =
      generatePaymentReference();

    const response =
      await axios.post(
        PAYSTACK_INITIALIZE_URL,
        {
          email,

          // Paystack expects Kobo
          amount: Math.round(amount * 100),

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
        }
      );

    const paystackData =
      response.data?.data;

    if (!paystackData) {
      throw new Error(
        "Invalid Paystack response."
      );
    }

    return {
      reference,

      accessCode:
        paystackData.access_code,

      authorizationUrl:
        paystackData.authorization_url,
    };
  } catch (error) {
    console.error(
      "Paystack Initialize Error:",
      error.response?.data ||
        error.message
    );

    throw new Error(
      error.response?.data?.message ||
        "Unable to initialize payment."
    );
  }
}
