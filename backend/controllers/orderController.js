const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const Coupon = require("../models/couponModel");
const { generateOrderNumber } = require("../utils/generateOrderId");
const { computeOrderPricing, OrderPricingError } = require("../utils/orderPricing");
const { notifyOrderConfirmed, notifyOrderStatusChange } = require("../utils/orderNotifications");
const { logAdminAction } = require("../utils/auditLog");
const { hasPermission } = require("../middleware/rbac");
const { reserveCouponUsage, releaseCouponUsage: releasePerUserCouponUsage, CouponLimitError } = require("../utils/couponRedemption");
const { isRazorpayConfigured, getRazorpayInstance } = require("../utils/razorpayClient");

// ---------------------------------------------------------------------------
// NOTE ON PAYMENT METHODS (Track D — manual verification track):
// Only "UPI" and "BankTransfer" are handled by this controller today.
// "Razorpay" is handled separately by controllers/paymentController.js
// (Track E) since it needs a create-order-before-payment / verify-after-
// payment two-step flow, unlike the manual methods here which create the
// order immediately with a pending UTR.
// ---------------------------------------------------------------------------

// @desc    Create new order (manual UPI / Bank Transfer verification flow).
//          ALL prices, delivery charge, GST and totals are (re)computed
//          server-side from the database — nothing from the client body is
//          trusted for money-affecting fields.
// @route   POST /api/orders
// @access  Public / Private
const addOrderItems = async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, utr, paymentScreenshotPublicId, couponCode } = req.body;

    if (!["UPI", "BankTransfer"].includes(paymentMethod)) {
      if (paymentMethod === "Razorpay") {
        return res.status(400).json({
          message: "Please use POST /api/payments/razorpay/create-order for Razorpay payments.",
        });
      }
      return res.status(400).json({ message: "Invalid payment method" });
    }

    if (!utr || !utr.trim()) {
      return res.status(400).json({
        message: "Please enter the UTR / transaction reference number for your payment",
      });
    }

    const cleanUtr = utr.trim();
    // Validate UTR format: Indian UPI UTR / IMPS ref is typically 12 digits or alphanumeric (8-35 chars)
    if (cleanUtr.length < 8 || cleanUtr.length > 35 || !/^[A-Za-z0-9/_-]+$/.test(cleanUtr) || /^(.)\1+$/.test(cleanUtr)) {
      return res.status(400).json({
        message: "Please enter a valid UPI transaction reference / UTR number (at least 8 alphanumeric characters).",
      });
    }

    // Screenshot is strictly required for manual UPI/BankTransfer verification
    if (!paymentScreenshotPublicId || !paymentScreenshotPublicId.trim()) {
      return res.status(400).json({
        message: "A payment screenshot is required for manual payment verification. Please upload your payment screenshot before placing the order.",
      });
    }

    // Anti-fraud: prevent duplicate UTR reuse across active orders
    const duplicateUtrOrder = await Order.findOne({
      "paymentDetails.utr": cleanUtr,
      status: { $ne: "Cancelled" },
      paymentStatus: { $ne: "Failed" },
    });
    if (duplicateUtrOrder) {
      return res.status(400).json({
        message: "This UTR / transaction reference number has already been submitted for another order. Each payment transaction can only be used once.",
      });
    }

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

    const {
      verifiedItems, subtotal, offerDiscount, couponResult,
      deliveryCharge, isFreeDelivery, gstRate, gstAmount, totalPrice,
    } = pricing;

    // --- Stock deduction (reserved immediately to prevent overselling;
    // restored automatically if the order is cancelled or payment is
    // rejected by the admin) ---
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
          throw new Error(`Insufficient stock for "${item.name}". Please refresh your cart.`);
        }
      }

      // Reserve the coupon usage atomically alongside stock, so a coupon
      // can never be over-redeemed under concurrent checkouts.
      if (couponResult.valid && couponResult.coupon) {
        const couponUpdate = await Coupon.updateOne(
          {
            _id: couponResult.coupon._id,
            $or: [{ usageLimit: null }, { usageLimit: { $exists: false } }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
          },
          { $inc: { usedCount: 1 } },
          session ? { session } : {}
        );
        if (couponUpdate.matchedCount === 0) {
          throw new Error("This coupon just reached its usage limit. Please remove it and try again.");
        }

        // Per-user limit — atomic reservation via a dedicated tracking
        // collection (see utils/couponRedemption.js for why this closes
        // the TOCTOU race that a plain read-then-write check would have).
        await reserveCouponUsage(couponResult.coupon._id, req.user ? req.user._id : null, couponResult.coupon.perUserLimit, session);
      }

      const orderNumber = await generateOrderNumber();

      const order = new Order({
        orderNumber,
        user: req.user ? req.user._id : null,
        orderItems: verifiedItems,
        pricing: {
          subtotal,
          offerDiscount,
          couponCode: couponResult.valid ? couponResult.coupon.code : null,
          couponDiscount: couponResult.discount,
          deliveryCharge,
          isFreeDelivery,
          gstRate,
          gstAmount,
          totalPrice,
        },
        shippingAddress,
        paymentMethod,
        paymentDetails: { utr: utr.trim(), paymentScreenshotPublicId: paymentScreenshotPublicId || null },
        paymentStatus: "Pending Verification",
        status: "Pending Payment",
      });

      const createdOrder = session ? await order.save({ session }) : await order.save();

      if (session) {
        await session.commitTransaction();
        session.endSession();
      }

      res.status(201).json(createdOrder);
    } catch (innerErr) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      throw innerErr;
    }
  } catch (error) {
    console.error("Order Creation Error:", error);
    if (error.message && (error.message.startsWith("Insufficient stock") || error.message.includes("coupon") || error.message.includes("Coupon"))) {
      return res.status(400).json({ message: error.message });
    }
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : (error.message || "Server Error") });
  }
};

// @desc    Get all orders for Admin (with basic filtering + pagination)
// @route   GET /api/orders
// @access  Private/Admin
// Query params: status, paymentStatus (unchanged), page, limit.
// Previously this ran Order.find(filter).sort(...) with NO limit at all —
// every admin dashboard load (and every post-mutation refresh) pulled the
// entire orders collection into memory and over the wire. This now mirrors
// productController.getProducts' page/limit/pages/total envelope. The
// route itself is unchanged (already protect + requirePermission
// ("orders.view")), so this is purely a response-shape/query change.
const getOrders = async (req, res) => {
  try {
    const { status, paymentStatus, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const pageNum = Math.max(1, Number(page));
    // Higher cap than the public products endpoint (100) since this route
    // is already permission-gated (admin-tier only) rather than public —
    // the goal here is bounding the query, not rate-limiting public abuse.
    const limitNum = Math.min(200, Math.max(1, Number(limit)));

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      orders,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      total,
    });
  } catch (error) {
    console.error("Fetch Orders Error:", error);
    res.status(500).json({ message: "Server Error", error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
};

// Releases a coupon's usage slot when an order that used it is cancelled
// or its payment is rejected — so the customer (or another customer, for
// shared-limit coupons) can use it again.
const releaseCouponUsage = async (order) => {
  if (order.pricing?.couponCode) {
    const coupon = await Coupon.findOneAndUpdate(
      { code: order.pricing.couponCode, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } }
    );
    if (coupon && order.user) {
      await releasePerUserCouponUsage(coupon._id, order.user);
    }
  }
};

// @desc    Admin verifies or rejects a manually-submitted payment (UPI/Bank
//          Transfer). This is the ONLY way such an order's paymentStatus
//          moves out of "Pending Verification" — nothing is ever
//          auto-approved.
// @route   PUT /api/orders/:id/verify-payment
// @access  Private/Admin
const verifyPayment = async (req, res) => {
  try {
    const { action, reason } = req.body; // "approve" | "reject" | "request_correction"
    if (!["approve", "reject", "request_correction"].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve', 'reject', or 'request_correction'" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!["Pending Verification", "Correction Requested"].includes(order.paymentStatus)) {
      return res.status(400).json({ message: `Payment already ${order.paymentStatus}` });
    }

    if (action === "approve") {
      order.paymentStatus = "Verified";
      order.status = "Order Confirmed";
      order.isPaid = true;
      order.paymentVerifiedBy = req.user._id;
      order.paymentVerifiedAt = new Date();
      order.paymentDetails.rejectionReason = null;
    } else if (action === "request_correction") {
      order.paymentStatus = "Correction Requested";
      order.paymentDetails.rejectionReason = reason || "Please provide an updated payment screenshot or valid UTR number.";
    } else {
      order.paymentStatus = "Failed";
      order.status = "Payment Failed";
      order.paymentDetails.rejectionReason = reason || "Payment verification failed.";

      // Restock — the reservation made at order creation is released
      for (const item of order.orderItems) {
        await Product.updateOne({ _id: item.product }, { $inc: { qnt: item.quantity } });
      }
      await releaseCouponUsage(order);
    }

    const updated = await order.save();

    logAdminAction(req.user, `payment.${action}`, updated.orderNumber, {
      orderId: updated._id, amount: updated.pricing.totalPrice, reason: reason || null,
    });

    // Fire-and-forget — notification failures never block the API response.
    if (action === "approve") {
      notifyOrderConfirmed(updated).catch((err) => console.error("Notification error:", err));
    } else if (action === "reject") {
      notifyOrderStatusChange(updated, "Payment Failed").catch((err) => console.error("Notification error:", err));
    }

    res.json(updated);
  } catch (error) {
    console.error("Verify Payment Error:", error);
    res.status(500).json({ message: "Server Error", error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
};

// @desc    Update order status (shipment lifecycle)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingId, courierName, shipmentDate, estimatedDelivery } = req.body;
    const allowedStatuses = [
      "Pending Payment", "Payment Verified", "Order Confirmed", "Processing",
      "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled",
      "Payment Failed", "Refunded",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Restock if newly cancelled
    if (status === "Cancelled" && order.status !== "Cancelled") {
      for (const item of order.orderItems) {
        await Product.updateOne({ _id: item.product }, { $inc: { qnt: item.quantity } });
      }
      await releaseCouponUsage(order);
      order.cancellation.cancelledBy = "admin";
      order.cancellation.cancelledAt = new Date();
    }

    if (trackingId) order.shipment.trackingId = trackingId;
    if (courierName) order.shipment.courierName = courierName;
    if (shipmentDate) order.shipment.shipmentDate = shipmentDate;
    if (estimatedDelivery) order.shipment.estimatedDelivery = estimatedDelivery;

    const oldStatus = order.status;
    order.status = status;
    order.isDelivered = status === "Delivered";

    const updatedOrder = await order.save();

    logAdminAction(req.user, "order.status_changed", updatedOrder.orderNumber, { orderId: updatedOrder._id, from: oldStatus, to: status });

    if (["Shipped", "Out for Delivery", "Delivered", "Cancelled", "Refunded"].includes(status)) {
      notifyOrderStatusChange(updatedOrder, status).catch((err) => console.error("Notification error:", err));
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error("Update Order Status Error:", error);
    res.status(500).json({ message: "Server Error", error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
};

// @desc    Create a courier shipment for an order (Section 24). Runs in
//          mock mode until Professional Courier credentials are configured
//          — see utils/courierService.js. Either way, the resulting
//          tracking ID is saved onto the order exactly like a manually
//          entered one, so the rest of the admin/customer tracking UI
//          doesn't need to know or care whether it's real or mock.
// @route   POST /api/orders/:id/create-shipment
// @access  Private (orders.update permission)
const createShipmentForOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.shipment.trackingId) {
      return res.status(400).json({ message: "This order already has a tracking ID" });
    }

    const { createShipment } = require("../utils/courierService");
    const shipment = await createShipment(order);

    order.shipment.trackingId = shipment.trackingId;
    order.shipment.courierName = shipment.courierName;
    order.shipment.shipmentDate = new Date();

    const updatedOrder = await order.save();
    res.json({ ...updatedOrder.toObject(), _mockShipment: shipment.mock });
  } catch (error) {
    console.error("Create Shipment Error:", error);
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : (error.message || "Could not create shipment") });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
};

// @desc    Get single order (owner or admin only)
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const isOwner = order.user && String(order.user) === String(req.user._id);
    if (!isOwner && !hasPermission(req.user, "orders.view")) {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
};

// @desc    Generate a short-lived signed URL to view a payment screenshot.
//          The screenshot is stored under Cloudinary's "private" delivery
//          type (see routes/uploadRoutes.js) — there is no plain public URL
//          for it. Only the order's owner or an admin-tier user with
//          payments.verify permission can request this.
// @route   GET /api/orders/:id/payment-screenshot
// @access  Private
const getPaymentScreenshotUrl = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const isOwner = order.user && String(order.user) === String(req.user._id);
    if (!isOwner && !hasPermission(req.user, "payments.verify")) {
      return res.status(403).json({ message: "Not authorized to view this document" });
    }

    const publicId = order.paymentDetails?.paymentScreenshotPublicId;
    if (!publicId) {
      return res.status(404).json({ message: "No payment screenshot was submitted for this order" });
    }

    const cloudinary = require("cloudinary").v2;
    const url = cloudinary.url(publicId, {
      type: "private",
      sign_url: true,
      resource_type: "image",
      secure: true,
    });

    res.json({ url });
  } catch (error) {
    console.error("Get Payment Screenshot URL Error:", error);
    res.status(500).json({ message: "Could not generate screenshot URL" });
  }
};

// @desc    Cancel own order or request cancellation (Stages: BOOKED -> PACKING -> SHIPPING -> DELIVERY)
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelMyOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized to cancel this order" });
    }

    const nonCancellable = ["Shipped", "Out for Delivery", "Delivered", "Cancelled", "Refunded"];
    if (nonCancellable.includes(order.status)) {
      return res.status(400).json({ message: `Order cannot be cancelled once it has reached the ${order.status} stage.` });
    }

    // Stage 2: PACKING ("Processing", "Packed")
    // Because live fish / aquatic life are custom-packed with oxygen bags and thermal boxes,
    // customers cannot directly cancel once packing has begun. They submit a cancellation request.
    const packingStages = ["Processing", "Packed"];
    if (packingStages.includes(order.status)) {
      order.cancellation.status = "Requested";
      order.cancellation.reason = reason || "Customer requested cancellation during packaging";
      order.cancellation.requestedAt = new Date();
      order.cancellation.cancelledBy = "customer";

      const updatedOrder = await order.save();
      logAdminAction(req.user, "order.cancellation_requested", updatedOrder.orderNumber, {
        orderId: updatedOrder._id, reason: order.cancellation.reason,
      });

      return res.status(200).json({
        message: "Cancellation request submitted. Because your aquatic order is currently in the packing stage, store management will review and process your request.",
        order: updatedOrder,
      });
    }

    // Stage 1: BOOKED ("Pending Payment", "Payment Verified", "Order Confirmed")
    // Direct cancellation allowed before packing begins.
    for (const item of order.orderItems) {
      await Product.updateOne({ _id: item.product }, { $inc: { qnt: item.quantity } });
    }
    await releaseCouponUsage(order);

    order.status = "Cancelled";
    order.cancellation = {
      status: "Approved",
      reason: reason || "Cancelled by customer before packing",
      cancelledBy: "customer",
      cancelledAt: new Date(),
    };

    if (order.paymentStatus === "Verified") {
      order.refund.status = "Pending";
      order.refund.amount = order.pricing.totalPrice;
    }

    const updatedOrder = await order.save();
    logAdminAction(req.user, "order.cancelled_by_customer", updatedOrder.orderNumber, {
      orderId: updatedOrder._id, reason: order.cancellation.reason,
    });
    notifyOrderStatusChange(updatedOrder, "Cancelled").catch((err) => console.error("Notification error:", err));
    res.json(updatedOrder);
  } catch (error) {
    console.error("Cancel Order Error:", error);
    res.status(500).json({ message: "Server Error", error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
};

// @desc    Admin reviews a customer's cancellation request
// @route   PUT /api/orders/:id/cancellation-review
// @access  Private/Admin (orders.update)
const reviewCancellationRequest = async (req, res) => {
  try {
    const { action, reason } = req.body; // "approve" | "reject"
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Action must be 'approve' or 'reject'" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.cancellation.status !== "Requested") {
      return res.status(400).json({ message: `No pending cancellation request for order ${order.orderNumber}` });
    }

    if (action === "approve") {
      for (const item of order.orderItems) {
        await Product.updateOne({ _id: item.product }, { $inc: { qnt: item.quantity } });
      }
      await releaseCouponUsage(order);

      order.status = "Cancelled";
      order.cancellation.status = "Approved";
      order.cancellation.reviewedBy = req.user._id;
      order.cancellation.reviewNotes = reason || "Cancellation approved by admin";
      order.cancellation.cancelledAt = new Date();

      if (order.paymentStatus === "Verified") {
        order.refund.status = "Pending";
        order.refund.amount = order.pricing.totalPrice;
      }
    } else {
      order.cancellation.status = "Rejected";
      order.cancellation.reviewedBy = req.user._id;
      order.cancellation.reviewNotes = reason || "Order packaging completed / dispatched — cannot cancel.";
    }

    const updatedOrder = await order.save();
    logAdminAction(req.user, `order.cancellation_${action}d`, updatedOrder.orderNumber, {
      orderId: updatedOrder._id, action, reviewNotes: order.cancellation.reviewNotes,
    });

    if (action === "approve") {
      notifyOrderStatusChange(updatedOrder, "Cancelled").catch((err) => console.error("Notification error:", err));
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error("Review Cancellation Error:", error);
    res.status(500).json({ message: "Server Error", error: process.env.NODE_ENV === "production" ? undefined : error.message });
  }
};

// @desc    Process refund (Razorpay API refund or manual UPI/Bank refund record)
// @route   POST /api/orders/:id/refund
// @access  Private/Admin (orders.update or payments.verify)
const processOrderRefund = async (req, res) => {
  try {
    const { amount, reason, reference, notes } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const refundAmount = Number(amount) || order.pricing.totalPrice;
    if (refundAmount <= 0) {
      return res.status(400).json({ message: "Refund amount must be greater than zero" });
    }

    if (order.paymentMethod === "Razorpay") {
      const paymentId = order.paymentDetails?.razorpayPaymentId;
      if (!paymentId) {
        return res.status(400).json({ message: "No Razorpay payment ID recorded for this order" });
      }
      if (!isRazorpayConfigured()) {
        return res.status(503).json({ message: "Razorpay is not configured on the server" });
      }

      const razorpay = getRazorpayInstance();
      const rzpRefund = await razorpay.payments.refund(paymentId, {
        amount: Math.round(refundAmount * 100),
        notes: {
          orderNumber: order.orderNumber,
          reason: reason || "Customer requested refund",
        },
      });

      order.refund = {
        status: "Processed",
        refundId: rzpRefund.id,
        amount: rzpRefund.amount / 100,
        reason: reason || "Processed via Razorpay API",
        method: "Razorpay",
        initiatedBy: req.user._id,
        initiatedAt: new Date(),
        processedAt: new Date(),
        reference: rzpRefund.id,
        notes: notes || "Automatic refund via Razorpay API",
      };
    } else {
      // Manual UPI / Bank Transfer refund
      if (!reference || !reference.trim()) {
        return res.status(400).json({
          message: "Please enter the UTR / bank reference number of the refund payment you made to the customer.",
        });
      }

      order.refund = {
        status: "Processed",
        refundId: reference.trim(),
        amount: refundAmount,
        reason: reason || "Manual refund to customer account",
        method: order.paymentMethod === "UPI" ? "Manual_UPI" : "Manual_Bank",
        initiatedBy: req.user._id,
        initiatedAt: new Date(),
        processedAt: new Date(),
        reference: reference.trim(),
        notes: notes || "Manual bank/UPI refund completed by store admin",
      };
    }

    order.paymentStatus = "Refunded";
    order.status = "Refunded";

    const updatedOrder = await order.save();

    logAdminAction(req.user, "order.refund_processed", updatedOrder.orderNumber, {
      orderId: updatedOrder._id,
      amount: refundAmount,
      method: order.refund.method,
      refundId: order.refund.refundId,
    });

    notifyOrderStatusChange(updatedOrder, "Refunded").catch((err) => console.error("Notification error:", err));

    res.json(updatedOrder);
  } catch (error) {
    console.error("Process Refund Error:", error);
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : (error.message || "Could not process refund") });
  }
};

module.exports = {
  addOrderItems,
  getOrders,
  getOrderById,
  getPaymentScreenshotUrl,
  verifyPayment,
  updateOrderStatus,
  createShipmentForOrder,
  getMyOrders,
  cancelMyOrder,
  reviewCancellationRequest,
  processOrderRefund,
};
