const express = require("express");
const router = express.Router();
const {
  checkDelivery,
  getDeliveryRules,
  createDeliveryRule,
  updateDeliveryRule,
  deleteDeliveryRule,
} = require("../controllers/deliveryController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

// Public — used by the checkout page to preview delivery charge
router.get("/check", checkDelivery);

// Admin — manage delivery rules
router.route("/rules")
  .get(protect, requirePermission("delivery.manage"), getDeliveryRules)
  .post(protect, requirePermission("delivery.manage"), createDeliveryRule);

router.route("/rules/:id")
  .put(protect, requirePermission("delivery.manage"), updateDeliveryRule)
  .delete(protect, requirePermission("delivery.manage"), deleteDeliveryRule);

module.exports = router;
