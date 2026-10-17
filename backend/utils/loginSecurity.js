const User = require("../models/userModel");

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Is this account currently locked?
 */
function isAccountLocked(user) {
  return Boolean(user.lockUntil && user.lockUntil.getTime() > Date.now());
}

/**
 * Progressive delay (ms) applied before responding to a failed attempt,
 * scaled by how many consecutive failures have occurred so far. Capped so
 * a single request can never hang indefinitely.
 *
 *   attempt 1 -> 0ms      (no penalty on the very first miss)
 *   attempt 2 -> 500ms
 *   attempt 3 -> 1000ms
 *   attempt 4 -> 1500ms
 *   attempt 5+ -> 2000ms (capped)
 */
function getProgressiveDelayMs(failedAttemptCount) {
  const n = Math.max(0, Number(failedAttemptCount) || 0);
  if (n <= 1) return 0;
  return Math.min((n - 1) * 500, 2000);
}

async function applyProgressiveDelay(failedAttemptCount) {
  const ms = getProgressiveDelayMs(failedAttemptCount);
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// WHY THIS IS RACE-SAFE:
//
// A naive implementation would read user.failedLoginAttempts, add 1 in
// JavaScript, check if it hit the limit, and then save() the document. Two
// concurrent failed-login requests for the SAME account could both read the
// same starting count before either writes back, undercounting attempts
// (the exact class of bug already found and fixed elsewhere in this
// codebase for coupon usage — see utils/couponRedemption.js).
//
// Instead, this uses a MongoDB AGGREGATION-PIPELINE UPDATE (a feature of
// findOneAndUpdate that accepts an array of stages instead of a plain
// update object). MongoDB executes the stages against the CURRENT state of
// the document as a single atomic operation — no separate read step exists
// for another request to race against. Stage 1 increments the counter;
// stage 2 reads that ALREADY-INCREMENTED value (pipeline stages run
// sequentially within the same atomic update) to decide whether to set
// lockUntil. Concurrent calls for the same user are simply serialized by
// MongoDB's normal per-document write ordering, each seeing a consistent
// state.
// ---------------------------------------------------------------------------
async function recordFailedAttempt(userId) {
  const lockUntilIfTripped = new Date(Date.now() + LOCKOUT_DURATION_MS);

  const updated = await User.findOneAndUpdate(
    { _id: userId },
    [
      {
        $set: {
          failedLoginAttempts: { $add: [{ $ifNull: ["$failedLoginAttempts", 0] }, 1] },
        },
      },
      {
        $set: {
          lockUntil: {
            $cond: [
              { $gte: ["$failedLoginAttempts", MAX_FAILED_ATTEMPTS] },
              lockUntilIfTripped,
              "$lockUntil",
            ],
          },
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true }
  );

  return updated;
}

/**
 * Atomic reset on successful login — clears both the counter and any lock.
 */
async function resetFailedAttempts(userId) {
  await User.updateOne(
    { _id: userId },
    { $set: { failedLoginAttempts: 0, lockUntil: null } }
  );
}

module.exports = {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  isAccountLocked,
  getProgressiveDelayMs,
  applyProgressiveDelay,
  recordFailedAttempt,
  resetFailedAttempts,
};
