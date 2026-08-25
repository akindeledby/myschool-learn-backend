import crypto from "crypto";

/**
 * Generates a unique payment reference.
 *
 * Example:
 * EXL-20260701-8A3F9C7D2B
 */
export function generatePaymentReference() {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const random =
    crypto
      .randomBytes(5)
      .toString("hex")
      .toUpperCase();

  return `EXL-${date}-${random}`;
}