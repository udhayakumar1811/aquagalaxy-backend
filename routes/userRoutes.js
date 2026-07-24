const express = require("express");
const router = express.Router();
const { registerUser, loginUser } = require("../controllers/userController");

router.post("/register", registerUser);
router.post("/signup", registerUser); // Alternate endpoint safety
router.post("/login", loginUser);

module.exports = router;