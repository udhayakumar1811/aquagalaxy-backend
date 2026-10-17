const Razorpay = require("razorpay");

// Only initializes the Razorpay SDK if BOTH credentials are present. Every
// caller MUST check isRazorpayConfigured() before using getRazorpayInstance()
// — this file never throws just because keys are missing, so the rest of
// the app can boot and run fine with Razorpay simply turned off.
const isRazorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

let instance = null;
const getRazorpayInstance = () => {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return instance;
};

module.exports = { isRazorpayConfigured, getRazorpayInstance };
