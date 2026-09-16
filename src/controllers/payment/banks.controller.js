import axios from "axios";

export async function getNigerianBanks(req, res) {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error(
        "PAYSTACK_SECRET_KEY is not configured."
      );

      return res.status(500).json({
        success: false,
        message: "Payment service is not properly configured.",
      });
    }

    const allBanks = [];

    let nextCursor = null;

    do {
      const params = {
        country: "nigeria",
        use_cursor: true,
        perPage: 100,
      };

      if (nextCursor) {
        params.next = nextCursor;
      }

      const response = await axios.get(
        "https://api.paystack.co/bank",
        {
          params,
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      if (!response.data?.status) {
        return res.status(400).json({
          success: false,
          message:
            response.data?.message ||
            "Unable to retrieve Nigerian banks.",
        });
      }

      const banks = response.data?.data || [];

      allBanks.push(...banks);

      nextCursor =
        response.data?.meta?.next || null;
    } while (nextCursor);

    // ---------------------------------------------------------
    // Normalize Paystack's response for the frontend
    // ---------------------------------------------------------

    const normalizedBanks = allBanks
      .filter(
        (bank) =>
          bank.active === true &&
          bank.is_deleted !== true &&
          bank.code &&
          bank.name
      )
      .map((bank) => ({
        value: String(bank.code),
        label: bank.name,
        bankName: bank.name,
      }));

    // Remove duplicate bank codes
    const uniqueBanks = Array.from(
      new Map(
        normalizedBanks.map((bank) => [
          bank.value,
          bank,
        ])
      ).values()
    );

    // Optional: sort alphabetically
    uniqueBanks.sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    return res.status(200).json({
      success: true,
      message: "Nigerian banks retrieved successfully.",
      banks: uniqueBanks,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Paystack banks API error:",
        error.response?.data || error.message
      );

      return res.status(500).json({
        success: false,
        message:
          error.response?.data?.message ||
          "Unable to retrieve Nigerian banks.",
      });
    }

    console.error(
      "Unexpected error retrieving Nigerian banks:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while retrieving Nigerian banks.",
    });
  }
}

export async function resolveBankAccount(req, res) {
  try {
    const { accountNumber, bankCode } = req.body;

    // ---------------------------------------------------------
    // 1. Validate account number
    // ---------------------------------------------------------

    if (!accountNumber) {
      return res.status(400).json({
        success: false,
        message: "Account number is required.",
      });
    }

    const cleanAccountNumber = String(accountNumber).trim();

    if (!/^\d{10}$/.test(cleanAccountNumber)) {
      return res.status(400).json({
        success: false,
        message: "Account number must be exactly 10 digits.",
      });
    }

    // ---------------------------------------------------------
    // 2. Validate bank code
    // ---------------------------------------------------------

    if (!bankCode) {
      return res.status(400).json({
        success: false,
        message: "Bank code is required.",
      });
    }

    const cleanBankCode = String(bankCode).trim();

    if (!/^\d+$/.test(cleanBankCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bank code.",
      });
    }

    // ---------------------------------------------------------
    // 3. Make sure Paystack secret key exists
    // ---------------------------------------------------------

    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error(
        "PAYSTACK_SECRET_KEY is not configured."
      );

      return res.status(500).json({
        success: false,
        message: "Payment service is not properly configured.",
      });
    }

    // ---------------------------------------------------------
    // 4. Resolve account through Paystack
    // ---------------------------------------------------------

    const response = await axios.get(
      "https://api.paystack.co/bank/resolve",
      {
        params: {
          account_number: cleanAccountNumber,
          bank_code: cleanBankCode,
        },
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    // ---------------------------------------------------------
    // 5. Check Paystack response
    // ---------------------------------------------------------

    if (!response.data?.status) {
      return res.status(400).json({
        success: false,
        message:
          response.data?.message ||
          "Unable to resolve bank account.",
      });
    }

    const account = response.data?.data;

    if (!account?.account_name) {
      return res.status(400).json({
        success: false,
        message:
          "Unable to retrieve the account name. Please check the account number and bank.",
      });
    }

    // ---------------------------------------------------------
    // 6. Return normalized response to frontend
    // ---------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Bank account verified successfully.",
      account: {
        accountNumber:
          account.account_number || cleanAccountNumber,

        accountName: account.account_name,

        bankCode: cleanBankCode,
      },
    });
  } catch (error) {
    // ---------------------------------------------------------
    // 7. Handle Paystack errors
    // ---------------------------------------------------------

    if (axios.isAxiosError(error)) {
      const paystackMessage =
        error.response?.data?.message;

      console.error(
        "Paystack account resolution error:",
        paystackMessage || error.message
      );

      return res.status(
        error.response?.status >= 400 &&
        error.response?.status < 500
          ? error.response.status
          : 500
      ).json({
        success: false,
        message:
          paystackMessage ||
          "Unable to verify the bank account. Please check the account number and selected bank.",
      });
    }

    // ---------------------------------------------------------
    // 8. Handle unexpected errors
    // ---------------------------------------------------------

    console.error(
      "Unexpected error resolving bank account:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while verifying the bank account.",
    });
  }
}