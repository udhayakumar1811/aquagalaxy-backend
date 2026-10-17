const express = require("express");
const router = express.Router();
const {
  validateCouponPreview,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require("../controllers/couponController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

router.post("/validate", validateCouponPreview);

router.route("/admin")
  .get(protect, requirePermission("coupons.manage"), getCoupons)
  .post(protect, requirePermission("coupons.manage"), createCoupon);

router.route("/admin/:id")
  .put(protect, requirePermission("coupons.manage"), updateCoupon)
  .delete(protect, requirePermission("coupons.manage"), deleteCoupon);

module.exports = router;
