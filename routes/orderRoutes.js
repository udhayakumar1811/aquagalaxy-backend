const express = require("express");
const router = express.Router();
const {
  addOrderItems,
  getOrders,
  updateOrderStatus,
  getMyOrders,
  cancelMyOrder,
} = require("../controllers/orderController");
const { protect, admin } = require("../middleware/authMiddleware");

// Routes
router.route("/myorders").get(protect, getMyOrders);

router.route("/")
  .post(addOrderItems)
  .get(protect, admin, getOrders);

router.route("/:id/status").put(protect, admin, updateOrderStatus);
router.route("/:id/cancel").put(protect, cancelMyOrder);

module.exports = router;