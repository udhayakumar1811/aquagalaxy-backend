const mongoose = require("mongoose");

// Tracks how many times EACH user has redeemed EACH coupon. Deliberately a
// separate collection from Coupon (rather than an embedded map) so the
// atomic "reserve a slot" operation (see utils/couponRedemption.js) can use
// MongoDB's upsert + unique-index behavior to correctly enforce a bounded
// per-user limit under concurrent requests — see that file's comments for
// the full reasoning. This exists specifically to close the TOCTOU race
// identified in the production audit, where the previous implementation
// (a plain countDocuments() read followed by a later write) allowed two
// concurrent checkouts from the same account to both succeed.
const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    count: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

// The unique index is the actual enforcement mechanism: it's what turns an
// "insert past the limit" attempt into a guaranteed, atomic duplicate-key
// error rather than a race-prone read-then-write.
couponRedemptionSchema.index({ coupon: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("CouponRedemption", couponRedemptionSchema);
