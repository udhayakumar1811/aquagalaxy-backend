const express = require("express");
const router = express.Router();
const { getAnalytics } = require("../controllers/analyticsController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

router.get("/", protect, requirePermission("orders.view"), getAnalytics);

module.exports = router;
