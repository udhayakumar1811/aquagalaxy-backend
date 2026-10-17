const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
  getUserAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  resetPasswordWithOtp,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { sendOtp, verifyOtp } = require("../controllers/otpController");
const { protect } = require("../middleware/authMiddleware");

// OTP routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

// Auth routes (Full Endpoint: /api/users/register & /api/users/login)
router.post("/register", registerUser);
router.post("/login", loginUser);

// Password reset routes (OTP based and email based)
router.post("/reset-password-otp", resetPasswordWithOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Profile routes (Private)
router
  .route("/profile")
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile)
  .delete(protect, deleteUserProfile);

// Saved Addresses routes (Private)
router
  .route("/addresses")
  .get(protect, getUserAddresses)
  .post(protect, addAddress);

router
  .route("/addresses/:id")
  .put(protect, updateAddress)
  .delete(protect, deleteAddress);

router.put("/addresses/:id/default", protect, setDefaultAddress);

module.exports = router;
