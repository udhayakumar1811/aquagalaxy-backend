const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/orderController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

// Routes
router.route("/myorders").get(protect, getMyOrders);

router.route("/")
  .post(optionalAuth, addOrderItems) // guest checkout works; logged-in users get their order linked
  .get(protect, requirePermission("orders.view"), getOrders);

router.route("/:id").get(protect, getOrderById);
router.route("/:id/payment-screenshot").get(protect, getPaymentScreenshotUrl);
router.route("/:id/status").put(protect, requirePermission("orders.update"), updateOrderStatus);
router.route("/:id/create-shipment").post(protect, requirePermission("orders.update"), createShipmentForOrder);
router.route("/:id/verify-payment").put(protect, requirePermission("payments.verify"), verifyPayment);
router.route("/:id/cancel").put(protect, cancelMyOrder);
router.route("/:id/cancellation-review").put(protect, requirePermission("orders.update"), reviewCancellationRequest);
router.route("/:id/refund").post(protect, requirePermission("orders.update"), processOrderRefund);

module.exports = router;
