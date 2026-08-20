const express = require("express");
const router = express.Router();
const { createContactMessage } = require("../controllers/contactController");

// POST /api/contact — Public: anyone can submit the contact form
router.post("/", createContactMessage);

module.exports = router;
