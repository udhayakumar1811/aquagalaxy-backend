// ---------------------------------------------------------------------------
// WHATSAPP BUSINESS CLOUD API (Section 25/26/27)
//
// Uses Meta's official WhatsApp Business Cloud API — NOT browser automation
// or unofficial scraping (the spec explicitly forbids those). Configure via:
//   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
// in your .env file, obtained from your Meta Business/WhatsApp Business
// account setup.
//
// IMPORTANT — business-initiated messages (i.e. anything sent to a customer
// or admin who hasn't messaged you in the last 24 hours) generally require
// a pre-approved MESSAGE TEMPLATE in the Meta Business dashboard — you
// cannot send arbitrary free-text via the API outside that 24-hour window.
// The functions below send a text message for simplicity, which works
// within an active conversation window; once you have real access, replace
// the payload in sendWhatsAppMessage() with a `template` message type
// referencing your approved template name, per Meta's docs — this file
// does not invent a specific template name/structure since that depends on
// what you get approved.
// ---------------------------------------------------------------------------

const isWhatsAppConfigured = () =>
  Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/**
 * Send a WhatsApp text message via the Cloud API. Safely no-ops (with a
 * console warning) if not configured — never throws, since a notification
 * failure should never break the order/payment flow that triggered it.
 * @param {string} to - recipient phone number, digits only, with country code (e.g. "916381582969")
 * @param {string} message - the text to send
 */
async function sendWhatsAppMessage(to, message) {
  if (!isWhatsAppConfigured()) {
    console.warn(`⚠️  WhatsApp not configured — skipped sending to ${to}: "${message.slice(0, 60)}..." Set WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID in .env to enable.`);
    return { sent: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("WhatsApp send failed:", data);
      return { sent: false, reason: "api_error", error: data };
    }
    return { sent: true, data };
  } catch (error) {
    console.error("WhatsApp send error:", error.message);
    return { sent: false, reason: "network_error", error: error.message };
  }
}

// --- Message builders (Section 26/27) ---

/**
 * Formats the admin new-order notification exactly per Section 26's example.
 */
function buildAdminOrderMessage(order) {
  const itemLines = order.orderItems
    .map((i) => `• ${i.name} × ${i.quantity} — ₹${(i.discountPrice ?? i.price) * i.quantity}`)
    .join("\n");

  return `🐟 NEW UDHAYA AQUATICS ORDER

Order ID: ${order.orderNumber}

Customer: ${order.shippingAddress.fullName}
Phone: ${order.shippingAddress.phone}
WhatsApp: ${order.shippingAddress.whatsapp || order.shippingAddress.phone}
Email: ${order.shippingAddress.email}

Products:
${itemLines}

Subtotal: ₹${order.pricing.subtotal}
Discount: ₹${(order.pricing.offerDiscount || 0) + (order.pricing.couponDiscount || 0)}
Delivery: ₹${order.pricing.deliveryCharge}

TOTAL: ₹${order.pricing.totalPrice}

Payment: ${order.paymentMethod}
Payment Status: ${order.paymentStatus}

Address:
${order.shippingAddress.address}
City: ${order.shippingAddress.city}
District: ${order.shippingAddress.district || "-"}
State: ${order.shippingAddress.state}
Pincode: ${order.shippingAddress.pincode}

Order Status: ${order.status}`;
}

/**
 * Formats a customer-facing status-update message for the given event.
 */
function buildCustomerStatusMessage(order, event) {
  const messages = {
    "Order Confirmed": `Hi ${order.shippingAddress.fullName}! Your UDHAYA AQUATICS order ${order.orderNumber} has been confirmed. Total: ₹${order.pricing.totalPrice}.`,
    "Shipped": `Your order ${order.orderNumber} has shipped!${order.shipment?.trackingId ? ` Tracking ID: ${order.shipment.trackingId}` : ""}`,
    "Out for Delivery": `Your order ${order.orderNumber} is out for delivery today!`,
    "Delivered": `Your order ${order.orderNumber} has been delivered. Thanks for shopping with UDHAYA AQUATICS! 🐠`,
    "Cancelled": `Your order ${order.orderNumber} has been cancelled.`,
    "Refunded": `Your refund for order ${order.orderNumber} has been processed.`,
  };
  return messages[event] || `Update on your order ${order.orderNumber}: ${event}`;
}

module.exports = {
  isWhatsAppConfigured,
  sendWhatsAppMessage,
  buildAdminOrderMessage,
  buildCustomerStatusMessage,
};
