const User = require("../models/userModel");
const { logAdminAction } = require("../utils/auditLog");

// @desc    List all users (customers + staff), search by name/email
// @route   GET /api/admin/users
// @access  Private/Admin (full-access roles only — see routes/adminUserRoutes.js)
const getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    // Never expose password hashes.
    const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const ASSIGNABLE_ROLES = [
  "user", "admin", "superadmin", "order_manager",
  "product_manager", "support_manager", "content_manager",
];

// @desc    Change a user's role (Section 32 — admin staff role assignment)
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Prevent an admin from demoting/locking themselves out by accident,
    // which could leave the store with no admin access at all.
    if (String(req.params.id) === String(req.user._id) && role !== req.user.role) {
      return res.status(400).json({ message: "You cannot change your own role" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const oldRole = user.role;
    user.role = role;
    await user.save();

    logAdminAction(req.user, "admin.role_changed", user.name, { userId: user._id, from: oldRole, to: role });

    res.json({ message: "Role updated", user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Enable/disable a user account without deleting it
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
const updateUserStatus = async (req, res) => {
  try {
    const { isDisabled } = req.body;

    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot disable your own account" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isDisabled = !!isDisabled;
    await user.save();

    res.json({ message: isDisabled ? "Account disabled" : "Account enabled" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getUsers, updateUserRole, updateUserStatus };
