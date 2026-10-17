const express = require("express");
const router = express.Router();
const { getBanner, updateBanner } = require("../controllers/bannerController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

router.route("/").get(getBanner).put(protect, requirePermission("banner.manage"), updateBanner);

module.exports = router;