const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    image: { type: String },
    price: { type: Number, required: true }, // unit price snapshot at order time (server-verified)
    discountPrice: { type: Number, default: null },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Human-friendly order number, e.g. "AQ1001". Generated once via
    // utils/generateOrderId.js — never derived from the Mongo _id.
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    orderItems: [orderItemSchema],

    // --- Pricing breakdown (all figures computed & verified server-side) ---
    pricing: {
      subtotal: { type: Number, required: true },
      offerDiscount: { type: Number, default: 0 },
      couponCode: { type: String, default: null },
      couponDiscount: { type: Number, default: 0 },
      deliveryCharge: { type: Number, required: true, default: 0 },
      isFreeDelivery: { type: Boolean, default: false },
      gstRate: { type: Number, default: 0 },
      gstAmount: { type: Number, default: 0 },
      totalPrice: { type: Number, required: true },
    },

    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      whatsapp: { type: String },
      email: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      district: { type: String },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },

    // --- Payment ---
    paymentMethod: {
      type: String,
      enum: ["Razorpay", "UPI", "BankTransfer"],
      required: true,
    },
    paymentDetails: {
      razorpayOrderId: { type: String, default: null },
      razorpayPaymentId: { type: String, default: null },
      razorpaySignature: { type: String, default: null },
      utr: { type: String, default: null }, // customer-submitted UTR/transaction ref for manual methods
      // Cloudinary public_id for the payment screenshot, stored under
      // "private" delivery type — NOT a publicly-viewable URL. Viewing it
      // requires a freshly-generated signed URL (see
      // controllers/orderController.getPaymentScreenshotUrl), authorized
      // to the order's owner or an admin with payments.verify permission.
      paymentScreenshotPublicId: { type: String, default: null },
      rejectionReason: { type: String, default: null },
    },
    paymentStatus: {
      type: String,
      enum: ["Pending Verification", "Verified", "Failed", "Refunded", "Correction Requested"],
      default: "Pending Verification",
    },
    paymentVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    paymentVerifiedAt: { type: Date, default: null },

    // --- Order lifecycle ---
    status: {
      type: String,
      enum: [
        "Pending Payment",
        "Payment Verified",
        "Order Confirmed",
        "Processing",
        "Packed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Payment Failed",
        "Refunded",
      ],
      default: "Pending Payment",
    },

    // --- Shipment / courier ---
    shipment: {
      courierName: { type: String, default: null },
      trackingId: { type: String, default: null },
      shipmentDate: { type: Date, default: null },
      estimatedDelivery: { type: Date, default: null },
    },

    // --- Cancellation workflow (Stages: BOOKED -> PACKING -> SHIPPING -> DELIVERY) ---
    cancellation: {
      status: {
        type: String,
        enum: ["None", "Requested", "Approved", "Rejected"],
        default: "None",
      },
      reason: { type: String, default: null },
      requestedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reviewNotes: { type: String, default: null },
      cancelledBy: { type: String, enum: ["customer", "admin", null], default: null },
      cancelledAt: { type: Date, default: null },
    },

    // --- Refund details (Razorpay API & Manual UPI) ---
    refund: {
      status: {
        type: String,
        enum: ["None", "Pending", "Initiated", "Processed", "Failed"],
        default: "None",
      },
      refundId: { type: String, default: null },
      amount: { type: Number, default: null },
      reason: { type: String, default: null },
      method: { type: String, enum: ["Razorpay", "Manual_UPI", "Manual_Bank", null], default: null },
      initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      initiatedAt: { type: Date, default: null },
      processedAt: { type: Date, default: null },
      reference: { type: String, default: null },
      notes: { type: String, default: null },
    },

    // Kept for backward compatibility with older order-tracking UI code
    // that reads these directly; derived from status/paymentStatus.
    isPaid: { type: Boolean, default: false },
    isDelivered: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ "paymentDetails.utr": 1 }, { sparse: true });
orderSchema.index({ "paymentDetails.razorpayPaymentId": 1 }, { sparse: true });
orderSchema.index({ "cancellation.status": 1 });
orderSchema.index({ "shippingAddress.pincode": 1 });
orderSchema.index({ "shippingAddress.state": 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
