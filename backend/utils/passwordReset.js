const crypto = require("crypto");

// ---------------------------------------------------------------------------
// PASSWORD RESET TOKENS
//
// - The raw token is a 32-byte random value, sent to the user once (in the
//   email link) and never persisted anywhere.
// - Only its SHA-256 hash is stored on the User document, so a database
//   read/leak can never be used to forge a working reset link (same
//   principle as never storing raw passwords).
// - Tokens expire and are single-use — see authController.forgotPassword /
//   resetPassword, which atomically "claim" (clear) the stored hash the
//   moment a reset succeeds, the same atomic-claim pattern already used for
//   Razorpay's pending-payment records elsewhere in this codebase.
// ---------------------------------------------------------------------------

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateResetToken() {
  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
  };
}

module.exports = {
  RESET_TOKEN_EXPIRY_MS,
  hashToken,
  generateResetToken,
};
