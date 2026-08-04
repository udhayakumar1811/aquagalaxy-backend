const express = require("express");
const router = express.Router();

// Controllers import
// (ஒருவேளை உங்கள் Login/Register "authController.js"-ல் இருந்தால் கீழே உள்ள வரியை பயன்படுத்துங்கள்)
const { registerUser, loginUser, getUserProfile } = require("../controllers/authController");

// (அல்லது Login/Register "userController.js"-ல் இருந்தால் மேல உள்ள வரியை கமெண்ட் செய்துவிட்டு இதை பயன்படுத்தலாம்)
// const { registerUser, loginUser, getUserProfile } = require("../controllers/userController");

const { protect } = require("../middleware/authMiddleware");

// 🎯 Auth Routes (Full Endpoint: /api/users/register & /api/users/login)
router.post("/register", registerUser);
router.post("/login", loginUser);

// 🎯 Profile Route (Optional)
if (getUserProfile) {
  router.get("/profile", protect, getUserProfile);
}

module.exports = router;