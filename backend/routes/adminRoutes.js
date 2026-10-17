const express = require("express");
const router = express.Router();
const {
  getContactMessages,
  deleteContactMessage,
} = require("../controllers/contactController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

// GET /api/admin/contacts — Private/Admin
router.get("/contacts", protect, requirePermission("contacts.manage"), getContactMessages);

// DELETE /api/admin/contacts/:id — Private/Admin
router.delete("/contacts/:id", protect, requirePermission("contacts.manage"), deleteContactMessage);

module.exports = router;
