const CouponRedemption = require("../models/couponRedemptionModel");

class CouponLimitError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

// ---------------------------------------------------------------------------
// WHY THIS IS ACTUALLY ATOMIC (not just "looks atomic"):
//
// The naive approach — count existing orders that used this coupon for this
// user, then compare to the limit, then create the order — has a
// read-then-write gap: two concurrent requests can both read "0 used" before
// either one writes anything, and both proceed.
//
// This function instead does ONE atomic MongoDB operation:
//
//   findOneAndUpdate(
//     { coupon, user, count: { $lt: perUserLimit } },
//     { $inc: { count: 1 } },
//     { upsert: true }
//   )
//
// MongoDB guarantees per-document write serialization, so exactly one of
// these three things happens, atomically, no matter how many requests race:
//
//   1. No redemption doc exists yet → upsert INSERTS a new one with
//      count: 1. First use always succeeds.
//   2. A doc exists with count < limit → the filter matches, $inc applies
//      to that single document. Safe concurrent increment.
//   3. A doc exists with count >= limit → the filter does NOT match (the
//      count condition fails), so MongoDB attempts to INSERT a new document
//      instead (upsert behavior when no match is found) — which collides
//      with the unique (coupon, user) index and throws a duplicate-key
//      error (Mongo error code 11000). We catch that specific error and
//      treat it as "limit reached" — this is what makes the boundary case
//      race-proof: only ONE of two simultaneous racers can ever win the
//      insert; the loser gets a real duplicate-key error from MongoDB
//      itself, not a value it read a moment too early.
// ---------------------------------------------------------------------------

/**
 * Atomically reserve one redemption slot for (couponId, userId), respecting
 * perUserLimit. Throws CouponLimitError if the limit is already reached.
 * No-ops (returns immediately) if userId or perUserLimit is null — matches
 * the existing "guest checkout" and "unlimited per-user" cases.
 */
async function reserveCouponUsage(couponId, userId, perUserLimit, session) {
  if (!userId || perUserLimit == null) return;

  try {
    await CouponRedemption.findOneAndUpdate(
      { coupon: couponId, user: userId, count: { $lt: perUserLimit } },
      { $inc: { count: 1 } },
      { upsert: true, new: true, session: session || undefined }
    );
  } catch (error) {
    if (error.code === 11000) {
      throw new CouponLimitError("You have already used this coupon the maximum number of times");
    }
    throw error;
  }
}

/**
 * Releases a previously-reserved redemption slot — called when an order
 * that used a coupon is cancelled or its payment is rejected, symmetric
 * with the existing global usedCount release in orderController.js.
 */
async function releaseCouponUsage(couponId, userId) {
  if (!userId) return;
  await CouponRedemption.updateOne(
    { coupon: couponId, user: userId, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
}

module.exports = { reserveCouponUsage, releaseCouponUsage, CouponLimitError };
