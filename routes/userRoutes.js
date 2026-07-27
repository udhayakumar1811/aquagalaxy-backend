const express = require("express");
const router = express.Router();
const { registerUser, loginUser } = require("../controllers/userController");
const {
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", registerUser);
router.post("/signup", registerUser);
router.post("/login", loginUser);

// Protected Profile routes
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.delete("/profile", protect, deleteUserProfile);

module.exports = router;