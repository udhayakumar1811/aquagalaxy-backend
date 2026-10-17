const mongoose = require("mongoose");

// Code-based discount the customer must enter at checkout (Section 19).
// Distinct from Offer (automatic, no code) — see offerModel.js.
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, default: null }, // caps a percentage discount's ₹ value

    minOrderValue: { type: Number, default: 0 },

    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },

    usageLimit: { type: Number, default: null }, // total redemptions across all customers, null = unlimited
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 }, // null = unlimited per user

    // Restriction — if either list is non-empty, the coupon only applies
    // when the cart contains a matching product/category. Empty = applies
    // to the whole cart.
    applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    applicableCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    freeDelivery: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// `code` already gets a unique index automatically from `unique: true`
// above — this explicit duplicate declaration (same field, same order,
// just missing `unique: true` here) triggered Mongoose's "Duplicate
// schema index" warning at startup. Removed; uniqueness is unaffected
// since the field-level `unique: true` index still exists.
module.exports = mongoose.model("Coupon", couponSchema);
