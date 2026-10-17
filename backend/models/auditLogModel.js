const mongoose = require("mongoose");

// Records sensitive admin actions (Section 49). Never store passwords,
// secrets, or API tokens in `metadata` — only business-relevant details
// (e.g. old/new status, product name, amount).
const auditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    adminName: { type: String, required: true }, // snapshot, survives if the admin account is later deleted
    action: { type: String, required: true }, // e.g. "product.created", "order.status_changed"
    target: { type: String, default: null }, // human-readable identifier of what was affected
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ admin: 1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
