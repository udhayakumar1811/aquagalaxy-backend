const express = require("express");
const router = express.Router();
const { createRazorpayOrder, verifyRazorpayPayment, handleRazorpayWebhook } = require("../controllers/paymentController");
const { optionalAuth } = require("../middleware/authMiddleware");

router.post("/razorpay/create-order", optionalAuth, createRazorpayOrder);
router.post("/razorpay/verify", optionalAuth, verifyRazorpayPayment);

// Webhook — called by Razorpay's own servers, not a browser. No JWT is
// possible here; authenticity is proven entirely by the webhook signature
// check inside the controller. Deliberately NOT behind optionalAuth or the
// order-creation rate limiter (see server.js) — Razorpay may send bursts of
// webhook retries and rate-limiting those would defeat the reliability
// backstop this endpoint exists to provide.
router.post("/razorpay/webhook", handleRazorpayWebhook);

module.exports = router;
