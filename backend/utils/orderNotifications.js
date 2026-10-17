const Settings = require("../models/settingsModel");
const { isEmailConfigured, sendEmail, templates } = require("./emailService");
const { isWhatsAppConfigured, sendWhatsAppMessage, buildAdminOrderMessage, buildCustomerStatusMessage } = require("./whatsappService");

// All notification sends are fire-and-forget from the caller's perspective
// — failures are logged, never thrown, so a broken SMTP/WhatsApp config
// can never break the actual order/payment flow that triggered it.

/**
 * Fires when an order transitions to "Order Confirmed" (payment verified,
 * whether via manual UPI/Bank Transfer approval or Razorpay). Section 26:
 * the admin WhatsApp notification is the core requirement here.
 */
async function notifyOrderConfirmed(order) {
  const settings = await Settings.getSettings();

  // Admin notification — fires whenever WhatsApp is configured, this is
  // the store owner's own "you got an order" alert, not a customer
  // marketing message, so it isn't gated behind customerNotificationsEnabled.
  if (isWhatsAppConfigured() && settings.notifications.whatsappOrderAlerts) {
    await sendWhatsAppMessage(settings.whatsapp.adminNumber, buildAdminOrderMessage(order));
  }

  // Customer email confirmation
  if (isEmailConfigured() && settings.notifications.emailEnabled) {
    const { subject, html } = templates.orderConfirmed(order);
    await sendEmail({ to: order.shippingAddress.email, subject, html });
  }

  // Customer WhatsApp confirmation (opt-in via Settings)
  if (isWhatsAppConfigured() && settings.whatsapp.customerNotificationsEnabled) {
    const to = order.shippingAddress.whatsapp || order.shippingAddress.phone;
    await sendWhatsAppMessage(to, buildCustomerStatusMessage(order, "Order Confirmed"));
  }
}

/**
 * Fires on customer-relevant status changes (Section 27): Shipped, Out for
 * Delivery, Delivered, Cancelled, Refunded, Payment Failed.
 */
async function notifyOrderStatusChange(order, event) {
  const settings = await Settings.getSettings();

  if (isEmailConfigured() && settings.notifications.emailEnabled) {
    const templateKey = {
      "Shipped": "shipped",
      "Delivered": "delivered",
      "Cancelled": "cancelled",
      "Refunded": "refunded",
      "Payment Failed": "paymentFailed",
    }[event];
    if (templateKey && templates[templateKey]) {
      const { subject, html } = templates[templateKey](order);
      await sendEmail({ to: order.shippingAddress.email, subject, html });
    }
  }

  if (isWhatsAppConfigured() && settings.whatsapp.customerNotificationsEnabled) {
    const to = order.shippingAddress.whatsapp || order.shippingAddress.phone;
    await sendWhatsAppMessage(to, buildCustomerStatusMessage(order, event));
  }
}

module.exports = { notifyOrderConfirmed, notifyOrderStatusChange };
