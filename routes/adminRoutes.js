const express = require("express");
const router = express.Router();
const {
  getContactMessages,
  deleteContactMessage,
} = require("../controllers/contactController");
const { protect, admin } = require("../middleware/authMiddleware");

// GET /api/admin/contacts — Private/Admin
router.get("/contacts", protect, admin, getContactMessages);

// DELETE /api/admin/contacts/:id — Private/Admin
router.delete("/contacts/:id", protect, admin, deleteContactMessage);

module.exports = router;
