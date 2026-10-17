const mongoose = require("mongoose");

// Bridges the two-step Razorpay flow: we create a Razorpay order (and this
// record) BEFORE payment, then only create the real Order document AFTER
// the payment signature is verified (Section 9/13 — never confirm an order
// before payment is verified). Holds everything needed to recreate the
// order at verify time WITHOUT trusting anything the client sends back
// except the Razorpay payment ID/signature.
//
// Auto-expires after 30 minutes via the TTL index below, so abandoned
// checkouts (payment never completed) don't leave orphaned records.
const pendingRazorpayOrderSchema = new mongoose.Schema({
  razorpayOrderId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  orderItems: { type: Array, required: true }, // raw client cart: [{ product, quantity }]
  shippingAddress: { type: Object, required: true },
  couponCode: { type: String, default: null },
  amount: { type: Number, required: true }, // paise, matches what was sent to Razorpay
  createdAt: { type: Date, default: Date.now, expires: 60 * 30 }, // TTL: 30 minutes
});

module.exports = mongoose.model("PendingRazorpayOrder", pendingRazorpayOrderSchema);
