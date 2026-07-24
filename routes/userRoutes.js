const express = require("express");
const router = express.Router();
const { registerUser, loginUser } = require("../controllers/userController");

// Ensure functions exist before passing to router
if (typeof registerUser === "function" && typeof loginUser === "function") {
  router.post("/register", registerUser);
  router.post("/signup", registerUser);
  router.post("/login", loginUser);
} else {
  console.error("❌ Controller functions are not properly imported!");
}

module.exports = router;