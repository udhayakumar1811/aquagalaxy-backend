const express = require("express");
const router = express.Router();
const {
  getPublicSettings,
  getAdminSettings,
  updateAdminSettings,
} = require("../controllers/settingsController");
const { protect, admin } = require("../middleware/authMiddleware");

router.get("/public", getPublicSettings);
router.get("/admin", protect, admin, getAdminSettings);
router.put("/admin", protect, admin, updateAdminSettings);

module.exports = router;
