const AuditLog = require("../models/auditLogModel");

// @desc    List recent audit log entries, optionally filtered
// @route   GET /api/admin/audit-logs?action=&admin=&limit=
// @access  Private/Admin (strict — see routes/auditLogRoutes.js)
const getAuditLogs = async (req, res) => {
  try {
    const { action, admin, limit = 100 } = req.query;
    const filter = {};
    if (action) filter.action = { $regex: action, $options: "i" };
    if (admin) filter.admin = admin;

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(500, Number(limit) || 100));

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getAuditLogs };
