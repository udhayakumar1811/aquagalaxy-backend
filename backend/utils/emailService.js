const nodemailer = require("nodemailer");

// ---------------------------------------------------------------------------
// EMAIL NOTIFICATIONS (Section 28)
//
// Uses plain SMTP via nodemailer — works with Gmail, SendGrid SMTP relay,
// Amazon SES SMTP, or any other SMTP provider. Configure via:
//   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD
// in your .env file.
//
// Same pattern as utils/courierService.js and utils/razorpayClient.js:
// every send function checks isEmailConfigured() first and safely no-ops
// (with a console warning) rather than throwing, since a missing email
// config should never break the actual order/payment flow it's attached to.
// ---------------------------------------------------------------------------

const isEmailConfigured = () =>
  Boolean(
    process.env.EMAIL_HOST &&
    process.env.EMAIL_PORT &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASSWORD
  );

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });
  }
  return transporter;
};

/**
 * Send an email. Safely no-ops (with a console warning) if EMAIL_* env
 * vars aren't set — never throws, since notification failures shouldn't
 * break the order/payment flow that triggered them.
 */
async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    console.warn(`⚠️  Email not configured — skipped sending "${subject}" to ${to}. Set EMAIL_HOST/PORT/USER/PASSWORD in .env to enable.`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    await getTransporter().sendMail({
      from: `"UDHAYA AQUATICS" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return { sent: true };
  } catch (error) {
    console.error("Email send failed:", error.message);
    return { sent: false, reason: "send_error", error: error.message };
  }
}

// --- Templates (Section 28's event list) ---

const templates = {
  welcome: (name) => ({
    subject: "Welcome to UDHAYA AQUATICS! 🐟",
    html: `<p>Hi ${name},</p><p>Thanks for creating an account with UDHAYA AQUATICS. Happy fish-keeping!</p>`,
  }),
  accountLockout: (name) => ({
    subject: "Security Notice: Your UDHAYA AQUATICS Account",
    html: `<p>Hi ${name},</p>
      <p>We noticed several unsuccessful login attempts on your account and have temporarily locked it for your protection.</p>
      <p>You can try logging in again shortly. If this wasn't you, no action is needed — the lock will expire on its own and no changes were made to your account.</p>`,
  }),
  passwordReset: (name, resetUrl) => ({
    subject: "Reset Your UDHAYA AQUATICS Password",
    html: `<p>Hi ${name},</p>
      <p>We received a request to reset your UDHAYA AQUATICS password. Click the link below to choose a new one:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 30 minutes and can only be used once. If you didn't request this, you can safely ignore this email — your password won't be changed.</p>`,
  }),
  orderConfirmed: (order) => ({
    subject: `Order Confirmed — ${order.orderNumber}`,
    html: `<p>Hi ${order.shippingAddress.fullName},</p>
      <p>Your order <strong>${order.orderNumber}</strong> has been confirmed.</p>
      <p>Total: ₹${order.pricing.totalPrice}</p>
      <p>We'll notify you again once it ships.</p>`,
  }),
  paymentFailed: (order) => ({
    subject: `Payment Issue — Order ${order.orderNumber}`,
    html: `<p>Hi ${order.shippingAddress.fullName},</p>
      <p>We couldn't verify the payment for order <strong>${order.orderNumber}</strong>. Please contact us with your payment reference so we can help.</p>`,
  }),
  shipped: (order) => ({
    subject: `Your Order Has Shipped — ${order.orderNumber}`,
    html: `<p>Hi ${order.shippingAddress.fullName},</p>
      <p>Order <strong>${order.orderNumber}</strong> is on its way!</p>
      ${order.shipment?.trackingId ? `<p>Tracking ID: ${order.shipment.trackingId} (${order.shipment.courierName || ""})</p>` : ""}`,
  }),
  delivered: (order) => ({
    subject: `Order Delivered — ${order.orderNumber}`,
    html: `<p>Hi ${order.shippingAddress.fullName},</p>
      <p>Your order <strong>${order.orderNumber}</strong> has been delivered. We hope you and your fish are happy! 🐠</p>
      <p>Loved your purchase? Leave a review on the product page.</p>`,
  }),
  cancelled: (order) => ({
    subject: `Order Cancelled — ${order.orderNumber}`,
    html: `<p>Hi ${order.shippingAddress.fullName},</p>
      <p>Your order <strong>${order.orderNumber}</strong> has been cancelled.</p>
      ${order.refund?.status === "Initiated" ? "<p>A refund has been initiated for this order.</p>" : ""}`,
  }),
  refunded: (order) => ({
    subject: `Refund Processed — ${order.orderNumber}`,
    html: `<p>Hi ${order.shippingAddress.fullName},</p>
      <p>Your refund of ₹${order.refund?.amount ?? order.pricing.totalPrice} for order <strong>${order.orderNumber}</strong> has been processed.</p>`,
  }),
};

module.exports = { isEmailConfigured, sendEmail, templates };
