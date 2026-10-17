const mongoose = require("mongoose");

// Automatic discount applied at checkout without a code (Section 20) —
// e.g. "20% off all fish food this week". Unlike Coupon, the customer
// doesn't type anything; the best matching offer for each cart item is
// applied automatically. See utils/pricingEngine.js for the resolution
// logic (one offer per item, no stacking, no negative totals).
const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, default: null },

    // Exactly one of these should be set — a product-specific offer or a
    // category-wide offer.
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },

    freeDelivery: { type: Boolean, default: false },

    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

offerSchema.index({ product: 1 });
offerSchema.index({ category: 1 });

module.exports = mongoose.model("Offer", offerSchema);
