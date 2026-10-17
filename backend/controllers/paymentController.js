const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Coupon = require("../models/couponModel");
const PendingRazorpayOrder = require("../models/pendingRazorpayOrderModel");
const { generateOrderNumber } = require("../utils/generateOrderId");
const { computeOrderPricing, OrderPricingError } = require("../utils/orderPricing");
const { isRazorpayConfigured, getRazorpayInstance } = require("../utils/razorpayClient");
const { notifyOrderConfirmed } = require("../utils/orderNotifications");
const { reserveCouponUsage, CouponLimitError } = require("../utils/couponRedemption");

class FinalizeError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// @desc    Step 1 of the Razorpay flow — compute the authoritative total
//          server-side, create a Razorpay order for that amount, and stash
//          the cart/address so step 2 can rebuild the real order without
//          trusting anything the client sends back except payment proof.
// @route   POST /api/payments/razorpay/create-order
// @access  Public / Private
const createRazorpayOrder = async (req, res) => {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({
      message: "Online card/UPI payment via Razorpay isn't set up yet. Please use UPI or Bank Transfer instead.",
    });
  }

  try {
    const { orderItems, shippingAddress, couponCode } = req.body;

    let pricing;
    try {
      pricing = await computeOrderPricing({
        orderItems,
        shippingAddress,
        couponCode,
        userId: req.user ? req.user._id : null,
      });
    } catch (err) {
      if (err instanceof OrderPricingError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      throw err;
    }

    const amountInPaise = Math.round(pricing.totalPrice * 100);
    if (amountInPaise <= 0) {
      return res.status(400).json({ message: "Order total must be greater than zero" });
    }

    const razorpay = getRazorpayInstance();
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `temp_${Date.now()}`,
    });

    await PendingRazorpayOrder.create({
      razorpayOrderId: razorpayOrder.id,
      user: req.user ? req.user._id : null,
      orderItems,
      shippingAddress,
      couponCode: couponCode || null,
      amount: amountInPaise,
    });

    // Only PUBLIC info goes to the client — never the key secret.
    res.status(201).json({
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      totalPrice: pricing.totalPrice,
    });
  } catch (error) {
    console.error("Razorpay Create Order Error:", error);
    res.status(500).json({ message: "Could not initiate payment. Please try again." });
  }
};

// ---------------------------------------------------------------------------
// SHARED FINALIZATION LOGIC — used by BOTH:
//   1. verifyRazorpayPayment  — the client-side checkout callback (fast path,
//      usually completes the order within the same page load)
//   2. handleRazorpayWebhook  — the server-to-server reliability backstop
//      (covers the case where the customer's browser/connection dies right
//      after paying but before the client-side verify call completes)
//
// Both paths can race to process the SAME payment. This function is written
// to be safe under that race:
//   - It checks for an already-created Order for this payment FIRST, and
//     returns that existing order (not an error) if found — this is what
//     makes duplicate delivery of the webhook, or a client retry, safe.
//   - It claims the PendingRazorpayOrder record with an atomic
//     findOneAndDelete, so only one caller can ever successfully create the
//     order from a given pending session, even if both paths reach this
//     function at nearly the same instant.
//   - Stock deduction re-checks availability atomically ($gte guard).
//   - Coupon usage (both global and per-user) is reserved atomically too.
// ---------------------------------------------------------------------------
async function finalizeRazorpayOrder({ razorpayOrderId, razorpayPaymentId, razorpaySignature, requestingUserId }) {
  // 1. Idempotency check — has this payment already been turned into an
  // order by the OTHER path?
  const existingOrder = await Order.findOne({ "paymentDetails.razorpayPaymentId": razorpayPaymentId });
  if (existingOrder) {
    return { alreadyProcessed: true, order: existingOrder };
  }

  // 2. Atomically claim the pending session.
  const pending = await PendingRazorpayOrder.findOneAndDelete({ razorpayOrderId });
  if (!pending) {
    // Could be a genuinely expired/unknown session, OR the other path won
    // the race between our check above and now — check once more before
    // reporting failure.
    const raceOrder = await Order.findOne({ "paymentDetails.razorpayPaymentId": razorpayPaymentId });
    if (raceOrder) return { alreadyProcessed: true, order: raceOrder };
    throw new FinalizeError(
      "Payment session expired, already processed, or not found. If you were charged and don't see an order, please contact us with your payment ID.",
      404
    );
  }

  // 3. If a logged-in user started checkout, the caller (when it can assert
  // an identity — i.e. the client path, not the webhook) must be that same
  // user. The webhook has no browser session to check, so it passes
  // requestingUserId: null and this check is skipped — the order still
  // correctly belongs to whichever user actually started the checkout
  // (pending.user), regardless of which path finalizes it.
  if (requestingUserId && pending.user && String(pending.user) !== String(requestingUserId)) {
    throw new FinalizeError("This payment session belongs to a different account", 403);
  }

  // 4. Recompute pricing fresh — protects against stock/price/coupon
  // changes in the time between order-creation and payment completion.
  let pricing;
  try {
    pricing = await computeOrderPricing({
      orderItems: pending.orderItems,
      shippingAddress: pending.shippingAddress,
      couponCode: pending.couponCode,
      userId: pending.user,
    });
  } catch (err) {
    console.error("Post-payment pricing re-validation failed:", err.message);
    throw new FinalizeError(
      `Payment was received, but your order could not be completed (${err.message}). Please contact us with your payment ID ${razorpayPaymentId} for a refund.`,
      409
    );
  }

  const {
    verifiedItems, subtotal, offerDiscount, couponResult,
    deliveryCharge, isFreeDelivery, gstRate, gstAmount, totalPrice,
  } = pricing;

  // 5. Amount actually paid must match what we computed.
  if (Math.round(totalPrice * 100) !== pending.amount) {
    console.error(`Amount mismatch: paid ${pending.amount}, recomputed ${Math.round(totalPrice * 100)}`);
    throw new FinalizeError(
      `Payment amount does not match the current order total. Please contact us with your payment ID ${razorpayPaymentId}.`,
      409
    );
  }

  // 6. Stock deduction + coupon reservation + order creation (transactional
  // where supported).
  const session = await mongoose.startSession().catch(() => null);
  try {
    if (session) session.startTransaction();

    for (const item of verifiedItems) {
      const updateResult = await Product.updateOne(
        { _id: item.product, qnt: { $gte: item.quantity } },
        { $inc: { qnt: -item.quantity } },
        session ? { session } : {}
      );
      if (updateResult.matchedCount === 0) {
        throw new Error(`Insufficient stock for "${item.name}"`);
      }
    }

    if (couponResult.valid && couponResult.coupon) {
      // Global limit — atomic conditional increment, same pattern as the
      // manual UPI/Bank Transfer flow (orderController.js). The previous
      // version of this Razorpay path used an UNCONDITIONAL $inc here with
      // no limit check at all — fixed while wiring up the per-user fix below.
      const couponUpdate = await Coupon.updateOne(
        {
          _id: couponResult.coupon._id,
          $or: [{ usageLimit: null }, { usageLimit: { $exists: false } }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
        },
        { $inc: { usedCount: 1 } },
        session ? { session } : {}
      );
      if (couponUpdate.matchedCount === 0) {
        throw new FinalizeError("This coupon just reached its usage limit.", 409);
      }

      // Per-user limit — atomic reservation (see utils/couponRedemption.js).
      await reserveCouponUsage(couponResult.coupon._id, pending.user, couponResult.coupon.perUserLimit, session);
    }

    const orderNumber = await generateOrderNumber();

    const order = new Order({
      orderNumber,
      user: pending.user,
      orderItems: verifiedItems,
      pricing: {
        subtotal, offerDiscount,
        couponCode: couponResult.valid ? couponResult.coupon.code : null,
        couponDiscount: couponResult.discount,
        deliveryCharge, isFreeDelivery, gstRate, gstAmount, totalPrice,
      },
      shippingAddress: pending.shippingAddress,
      paymentMethod: "Razorpay",
      paymentDetails: {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: razorpaySignature || null,
      },
      paymentStatus: "Verified",
      status: "Order Confirmed",
      isPaid: true,
      paymentVerifiedAt: new Date(),
    });

    const createdOrder = session ? await order.save({ session }) : await order.save();

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    notifyOrderConfirmed(createdOrder).catch((err) => console.error("Notification error:", err));

    return { alreadyProcessed: false, order: createdOrder };
  } catch (innerErr) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    throw innerErr;
  }
}

// @desc    Step 2 (client path) — verify the checkout signature, then hand
//          off to the shared finalize function.
// @route   POST /api/payments/razorpay/verify
// @access  Public / Private
const verifyRazorpayPayment = async (req, res) => {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({ message: "Razorpay is not configured" });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    // Verify the CHECKOUT signature (proves this specific browser session's
    // reported payment_id genuinely belongs to this order_id) — this is
    // distinct from the WEBHOOK signature used in handleRazorpayWebhook
    // below, which proves the whole HTTP request came from Razorpay.
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed — signature mismatch" });
    }

    const result = await finalizeRazorpayOrder({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      requestingUserId: req.user ? req.user._id : null,
    });

    res.status(result.alreadyProcessed ? 200 : 201).json(result.order);
  } catch (error) {
    if (error instanceof FinalizeError || error instanceof CouponLimitError) {
      return res.status(error.statusCode).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
    }
    console.error("Razorpay Verify Error:", error);
    res.status(500).json({ message: "Payment verification failed. Please contact support." });
  }
};

// @desc    Razorpay webhook — server-to-server reliability backstop for the
//          case where a customer's browser/connection dies right after
//          paying but before the client-side verify call completes. Without
//          this, that customer would be charged with no order ever created.
//
//          Configure in the Razorpay Dashboard under Settings > Webhooks:
//            URL: https://<your-backend-domain>/api/payments/razorpay/webhook
//            Active events: payment.captured (required); payment.failed (optional, logged only)
//            Secret: set the SAME value as RAZORPAY_WEBHOOK_SECRET in .env
//
// @route   POST /api/payments/razorpay/webhook
// @access  Public (authenticated via webhook signature, not JWT — Razorpay's
//          servers call this directly and cannot send a Bearer token)
const handleRazorpayWebhook = async (req, res) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error("⚠️  Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured — rejecting.");
    return res.status(503).json({ message: "Webhook not configured" });
  }

  const signature = req.headers["x-razorpay-signature"];
  if (!signature || !req.rawBody) {
    return res.status(400).json({ message: "Missing signature or request body" });
  }

  // Webhook signature — HMAC-SHA256 over the raw request body, using the
  // separate webhook secret configured in the Razorpay Dashboard (NOT the
  // same as RAZORPAY_KEY_SECRET). This is what proves the request actually
  // came from Razorpay's servers and wasn't spoofed/replayed with edited data.
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("hex");

  if (expectedSignature !== signature) {
    console.error("⚠️  Razorpay webhook signature mismatch — possible spoofed request, rejecting.");
    return res.status(400).json({ message: "Invalid signature" });
  }

  const event = req.body;

  // Only payment.captured actually confirms money has landed. Every other
  // event type is acknowledged with 200 (so Razorpay stops retrying it) but
  // not acted on — payment.failed in particular is intentionally NOT used
  // to auto-mark anything as failed, since the manual UPI/Bank Transfer
  // admin-approval flow is the only place "Failed" should come from for
  // non-Razorpay methods, and for Razorpay itself a failed payment simply
  // never produces an order (the pending session just expires via its TTL).
  if (event.event !== "payment.captured") {
    return res.status(200).json({ received: true, note: "Event type not processed" });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment || !payment.order_id || !payment.id) {
    console.error("Malformed payment.captured webhook payload:", JSON.stringify(event).slice(0, 500));
    return res.status(400).json({ message: "Malformed event payload" });
  }

  try {
    const result = await finalizeRazorpayOrder({
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      razorpaySignature: null, // not applicable — authenticity already proven by the webhook signature above
      requestingUserId: null, // webhook has no browser session to assert an identity against
    });

    console.log(
      `Razorpay webhook: payment.captured for order ${payment.order_id} — ${result.alreadyProcessed ? "already processed by client flow" : "order created by webhook"}`
    );
    return res.status(200).json({ received: true });
  } catch (error) {
    // Respond 200 even on a FinalizeError (e.g. stock ran out) so Razorpay
    // doesn't retry indefinitely — that class of failure needs manual admin
    // review regardless of how many times the webhook is redelivered, and
    // the customer-facing message was already surfaced via the client path
    // if it got that far. Only truly unexpected errors are worth a 5xx so
    // Razorpay's automatic retry can paper over a transient outage.
    if (error instanceof FinalizeError || error instanceof CouponLimitError) {
      console.error("Webhook finalize (expected) error:", error.message);
      return res.status(200).json({ received: true, note: "Processed with a warning — see server logs" });
    }
    console.error("Webhook finalize (unexpected) error:", error);
    return res.status(500).json({ message: "Internal error processing webhook" });
  }
};

module.exports = { createRazorpayOrder, verifyRazorpayPayment, handleRazorpayWebhook };
