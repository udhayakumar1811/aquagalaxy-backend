const express = require("express");
const router = express.Router();
const { getUsers, updateUserRole, updateUserStatus } = require("../controllers/adminUserController");
const { protect, admin } = require("../middleware/authMiddleware");

// Deliberately gated by the strict `admin` check (admin/superadmin only),
// NOT requirePermission — granting role/account management to a scoped
// role (order_manager, product_manager, etc.) would let that role escalate
// its own or others' privileges. This is the one area RBAC does not extend
// permission-based access to.
router.get("/", protect, admin, getUsers);
router.put("/:id/role", protect, admin, updateUserRole);
router.put("/:id/status", protect, admin, updateUserStatus);

module.exports = router;
