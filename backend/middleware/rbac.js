// ---------------------------------------------------------------------------
// Role-Based Access Control (Section 32).
//
// "admin" and "superadmin" always have full access ('*') — they are the
// full-privilege roles. The other roles are scoped to specific admin-panel
// sections. This is intentionally simple (a static map, not a database of
// per-user overrides) — enough to stop e.g. a support_manager from touching
// orders/payments, without building a full permissions-editor UI.
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS = {
  admin: ["*"],
  superadmin: ["*"],
  order_manager: [
    "orders.view", "orders.update", "payments.verify", "delivery.manage",
  ],
  product_manager: [
    "products.manage", "categories.manage", "coupons.manage", "offers.manage", "reviews.moderate",
  ],
  support_manager: [
    "contacts.manage", "reviews.moderate",
  ],
  content_manager: [
    "banner.manage", "gallery.manage",
  ],
};

const hasPermission = (user, permission) => {
  if (!user || !user.role) return false;
  const perms = ROLE_PERMISSIONS[user.role];
  if (!perms) return false;
  return perms.includes("*") || perms.includes(permission);
};

// Middleware factory — use AFTER `protect` so req.user is populated.
// Full-access roles (admin/superadmin) always pass. Other admin-tier roles
// only pass if their role's permission list includes the given permission.
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }
  if (req.user.isDisabled) {
    return res.status(403).json({ message: "This account has been disabled" });
  }
  if (hasPermission(req.user, permission)) {
    return next();
  }
  return res.status(403).json({ message: "You don't have permission to perform this action" });
};

// Same as requirePermission, but passes if the user has ANY of the given
// permissions. Used for routes shared across multiple admin roles — e.g.
// the single /api/upload endpoint is used by product_manager (product
// images) AND content_manager (banner/gallery images) alike.
const requireAnyPermission = (permissions) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }
  if (req.user.isDisabled) {
    return res.status(403).json({ message: "This account has been disabled" });
  }
  if (permissions.some((p) => hasPermission(req.user, p))) {
    return next();
  }
  return res.status(403).json({ message: "You don't have permission to perform this action" });
};

module.exports = { ROLE_PERMISSIONS, hasPermission, requirePermission, requireAnyPermission };
