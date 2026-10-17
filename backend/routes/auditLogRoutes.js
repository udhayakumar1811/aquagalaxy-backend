const express = require("express");
const router = express.Router();
const { getAuditLogs } = require("../controllers/auditLogController");
const { protect, admin } = require("../middleware/authMiddleware");

// Strict admin/superadmin only (like adminUserRoutes) — audit logs can
// reveal what other staff have been doing, which scoped roles shouldn't see.
router.get("/", protect, admin, getAuditLogs);

module.exports = router;
