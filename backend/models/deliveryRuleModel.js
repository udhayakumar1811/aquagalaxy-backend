const mongoose = require("mongoose");

// A single named quantity tier, e.g. { uptoQuantity: 3, charge: 100 } means
// "orders with up to 3 items cost ₹100 delivery". Tiers must be sorted by
// uptoQuantity ascending — the calculator picks the first tier whose
// uptoQuantity >= the order's total quantity.
const tierSchema = new mongoose.Schema(
  {
    uptoQuantity: { type: Number, required: true },
    charge: { type: Number, required: true },
  },
  { _id: false }
);

// Admin-configurable state/pincode delivery pricing rules (Section 17/18).
// Pricing is expressed as an explicit list of tiers (covers irregular slabs
// like "1-3 pairs = ₹100, 4-6 pairs = ₹150") plus a repeating step charge
// applied for quantities beyond the last defined tier (covers "above 6
// pairs, every additional 2 pairs adds ₹50").
const deliveryRuleSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, trim: true },
    pincode: { type: String, trim: true, default: null }, // null = applies to whole state

    tiers: {
      type: [tierSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one pricing tier is required",
      },
    },

    // Charge added for every `stepQuantity` items beyond the last tier's
    // uptoQuantity. E.g. stepQuantity: 2, stepCharge: 50 means every
    // additional 2 items beyond the last tier adds ₹50.
    beyondLastTier: {
      stepQuantity: { type: Number, required: true, default: 1 },
      stepCharge: { type: Number, required: true, default: 0 },
    },

    freeDeliveryThreshold: { type: Number, default: null }, // order subtotal ₹ above which delivery is free
    freeDelivery: { type: Boolean, default: false }, // force free delivery regardless of threshold

    isActive: { type: Boolean, default: true },
    isServiceable: { type: Boolean, default: true }, // false = explicitly not delivered here
  },
  { timestamps: true }
);

deliveryRuleSchema.index({ state: 1, pincode: 1 });

module.exports = mongoose.model("DeliveryRule", deliveryRuleSchema);
