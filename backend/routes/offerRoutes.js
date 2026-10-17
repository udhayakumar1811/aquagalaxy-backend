const express = require("express");
const router = express.Router();
const {
  getActiveOffers,
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
} = require("../controllers/offerController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

router.get("/active", getActiveOffers);

router.route("/admin")
  .get(protect, requirePermission("offers.manage"), getOffers)
  .post(protect, requirePermission("offers.manage"), createOffer);

router.route("/admin/:id")
  .put(protect, requirePermission("offers.manage"), updateOffer)
  .delete(protect, requirePermission("offers.manage"), deleteOffer);

module.exports = router;
