const express = require("express");
const router = express.Router();
const {
  createContactMessage,
  getContactMessages,
  deleteContactMessage,
} = require("../controllers/contactController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

// POST /api/contact — Public: anyone can submit the contact form
router.post("/", createContactMessage);

// Admin contact management: GET and DELETE on /api/contact or /api/contacts
router.get("/", protect, requirePermission("contacts.manage"), getContactMessages);
router.delete("/:id", protect, requirePermission("contacts.manage"), deleteContactMessage);

module.exports = router;
