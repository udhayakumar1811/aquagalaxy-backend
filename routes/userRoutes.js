const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// Auth routes (Full Endpoint: /api/users/register & /api/users/login)
router.post("/register", registerUser);
router.post("/login", loginUser);

// Profile routes (Private)
router
  .route("/profile")
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile)
  .delete(protect, deleteUserProfile);

module.exports = router;
