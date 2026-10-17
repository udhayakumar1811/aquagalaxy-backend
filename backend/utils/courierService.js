// ---------------------------------------------------------------------------
// PROFESSIONAL COURIER INTEGRATION LAYER (Section 24)
//
// IMPORTANT: Professional Courier's actual API base URL, authentication
// method, and request/response field names are NOT invented here — the
// spec explicitly forbids guessing them. Get the real API documentation
// from Professional Courier and fill in:
//   - PROFESSIONAL_COURIER_API_BASE_URL
//   - PROFESSIONAL_COURIER_API_KEY
//   - PROFESSIONAL_COURIER_ACCOUNT_ID
// in your .env file, then replace the `TODO` blocks below with real calls
// per their documentation.
//
// Until those are configured, this module runs in MOCK MODE: it generates
// a locally-formatted placeholder tracking ID so the admin workflow (add
// tracking ID → customer sees it → mark shipped) works end-to-end today.
// The admin can always overwrite a mock tracking ID with a real one once
// courier credentials are configured, via the existing "Update Order
// Status" tracking fields.
// ---------------------------------------------------------------------------

const isCourierConfigured = () =>
  Boolean(
    process.env.PROFESSIONAL_COURIER_API_BASE_URL &&
    process.env.PROFESSIONAL_COURIER_API_KEY &&
    process.env.PROFESSIONAL_COURIER_ACCOUNT_ID
  );

/**
 * Create a shipment for an order with Professional Courier.
 * @param {Object} order - the Mongo Order document
 * @returns {Promise<{ trackingId: string, courierName: string, mock: boolean }>}
 */
async function createShipment(order) {
  if (!isCourierConfigured()) {
    // MOCK MODE — generates a clearly-labeled placeholder so the rest of
    // the order-management workflow (status updates, customer tracking
    // display) can be built and tested before real credentials exist.
    const mockTrackingId = `MOCK-PC-${order.orderNumber}-${Date.now().toString().slice(-6)}`;
    console.warn(
      `⚠️  Professional Courier is not configured — generated a MOCK tracking ID (${mockTrackingId}) for order ${order.orderNumber}. Set PROFESSIONAL_COURIER_API_BASE_URL/API_KEY/ACCOUNT_ID in .env and implement the real API call in utils/courierService.js to go live.`
    );
    return { trackingId: mockTrackingId, courierName: "Professional Courier (mock)", mock: true };
  }

  // TODO: Replace with the real Professional Courier "create shipment" API
  // call once their documentation is available. Example shape (NOT
  // confirmed against real docs — verify field names before using):
  //
  //   const response = await fetch(`${process.env.PROFESSIONAL_COURIER_API_BASE_URL}/shipments`, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${process.env.PROFESSIONAL_COURIER_API_KEY}`,
  //     },
  //     body: JSON.stringify({
  //       accountId: process.env.PROFESSIONAL_COURIER_ACCOUNT_ID,
  //       orderNumber: order.orderNumber,
  //       recipient: order.shippingAddress,
  //       items: order.orderItems,
  //     }),
  //   });
  //   const data = await response.json();
  //   return { trackingId: data.trackingId, courierName: "Professional Courier", mock: false };
  //
  throw new Error(
    "Professional Courier credentials are set, but the real API integration hasn't been implemented yet — see the TODO in utils/courierService.js"
  );
}

/**
 * Look up current shipment status from Professional Courier.
 * @param {string} trackingId
 * @returns {Promise<{ status: string, mock: boolean }>}
 */
async function trackShipment(trackingId) {
  if (!isCourierConfigured() || trackingId.startsWith("MOCK-PC-")) {
    return { status: "Tracking unavailable (mock shipment — no real courier configured)", mock: true };
  }

  // TODO: Replace with the real Professional Courier "track shipment" API
  // call once their documentation is available.
  throw new Error(
    "Professional Courier credentials are set, but the real API integration hasn't been implemented yet — see the TODO in utils/courierService.js"
  );
}

module.exports = { isCourierConfigured, createShipment, trackShipment };
