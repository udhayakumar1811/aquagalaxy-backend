const AuditLog = require("../models/auditLogModel");

/**
 * Records a sensitive admin action. Fire-and-forget — failures are logged
 * to the console but never thrown, so a logging failure can never break
 * the actual admin action it's recording.
 *
 * @param {Object} adminUser - req.user (must have _id and name)
 * @param {string} action - dot-namespaced action, e.g. "product.deleted"
 * @param {string} target - human-readable identifier, e.g. a product name or order number
 * @param {Object} metadata - business-relevant details only — NEVER passwords/secrets/tokens
 */
async function logAdminAction(adminUser, action, target, metadata = {}) {
  try {
    if (!adminUser) return;
    await AuditLog.create({
      admin: adminUser._id,
      adminName: adminUser.name,
      action,
      target,
      metadata,
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

module.exports = { logAdminAction };
