const Product = require("../models/productModel");
const Settings = require("../models/settingsModel");
const { resolveOffers, resolveCoupon } = require("./pricingEngine");
const { calculateDeliveryCharge } = require("./deliveryCalculator");

// A plain Error subclass so callers can distinguish "bad user input, show
// this message" from unexpected server errors.
class OrderPricingError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Validates cart items against the database and computes the full,
 * authoritative order total: item prices, stock check, automatic offers,
 * coupon discount, delivery charge, and GST. NOTHING here is trusted from
 * the client except product IDs and quantities — every price and discount
 * is looked up or recalculated fresh.
 *
 * Used by BOTH the manual UPI/Bank Transfer flow (orderController) and the
 * Razorpay flow (paymentController) so the two payment paths can never
 * calculate a different total for the same cart.
 *
 * @param {Object} params
 * @param {Array} params.orderItems - [{ product, quantity }]
 * @param {Object} params.shippingAddress
 * @param {string|null} params.couponCode
 * @param {string|null} params.userId
 * @throws {OrderPricingError} on any validation failure (bad address, out of
 *         stock, invalid coupon, undeliverable location, etc.)
 * @returns {Promise<Object>} { verifiedItems, subtotal, totalQuantity,
 *   offerDiscount, couponResult, deliveryCharge, isFreeDelivery, gstRate,
 *   gstAmount, totalPrice }
 */
async function computeOrderPricing({ orderItems, shippingAddress, couponCode, userId }) {
  if (!orderItems || orderItems.length === 0) {
    throw new OrderPricingError("No order items found");
  }

  const requiredFields = ["fullName", "phone", "email", "address", "city", "state", "pincode"];
  for (const field of requiredFields) {
    if (!shippingAddress || !shippingAddress[field] || !String(shippingAddress[field]).trim()) {
      throw new OrderPricingError(`Shipping address is missing: ${field}`);
    }
    shippingAddress[field] = String(shippingAddress[field]).trim();
  }
  if (!/^\d{6}$/.test(shippingAddress.pincode)) {
    throw new OrderPricingError("Please enter a valid 6-digit pincode");
  }
  if (!/^\d{10}$/.test(shippingAddress.phone.replace(/\D/g, "").slice(-10))) {
    throw new OrderPricingError("Please enter a valid phone number");
  }

  const productIds = orderItems.map((item) => item.product);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  let totalQuantity = 0;
  const verifiedItems = [];
  const pricingItems = [];

  for (const item of orderItems) {
    const dbProduct = productMap.get(String(item.product));
    if (!dbProduct) {
      throw new OrderPricingError(`Product not found: ${item.name || item.product}`);
    }
    if (!dbProduct.isActive) {
      throw new OrderPricingError(`"${dbProduct.name}" is no longer available`);
    }

    const quantity = Number(item.quantity) || 1;
    if (quantity < 1) {
      throw new OrderPricingError(`Invalid quantity for ${dbProduct.name}`);
    }
    if (dbProduct.qnt < quantity) {
      throw new OrderPricingError(`Insufficient stock for "${dbProduct.name}". Only ${dbProduct.qnt} left.`);
    }

    const unitPrice = dbProduct.discountPrice ?? dbProduct.price;
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;
    totalQuantity += quantity;

    verifiedItems.push({
      name: dbProduct.name,
      quantity,
      image: dbProduct.image,
      price: dbProduct.price,
      discountPrice: dbProduct.discountPrice,
      product: dbProduct._id,
    });

    pricingItems.push({ product: dbProduct._id, category_id: dbProduct.category_id, lineTotal });
  }

  const { totalOfferDiscount, anyFreeDelivery: offerFreeDelivery } = await resolveOffers(pricingItems);
  const subtotalAfterOffers = Math.max(0, subtotal - totalOfferDiscount);

  let couponResult = { valid: false, discount: 0, freeDelivery: false, coupon: null };
  if (couponCode) {
    couponResult = await resolveCoupon(couponCode, subtotalAfterOffers, userId || null, pricingItems);
    if (!couponResult.valid) {
      throw new OrderPricingError(couponResult.message || "Invalid coupon");
    }
  }

  const deliveryResult = await calculateDeliveryCharge({
    state: shippingAddress.state,
    pincode: shippingAddress.pincode,
    totalQuantity,
    subtotal: subtotalAfterOffers,
  });
  if (!deliveryResult.isServiceable) {
    throw new OrderPricingError(deliveryResult.message || "Delivery is not available for this location");
  }

  const isFreeDelivery = deliveryResult.isFreeDelivery || offerFreeDelivery || couponResult.freeDelivery;
  const deliveryCharge = isFreeDelivery ? 0 : deliveryResult.charge;

  const settings = await Settings.getSettings();
  const gstRate = settings.tax.gstEnabled ? settings.tax.gstRate : 0;
  const amountAfterDiscounts = Math.max(0, subtotalAfterOffers - couponResult.discount);
  const gstAmount = Math.round(((amountAfterDiscounts + deliveryCharge) * gstRate) / 100);
  const totalPrice = amountAfterDiscounts + deliveryCharge + gstAmount;

  return {
    verifiedItems,
    subtotal,
    totalQuantity,
    offerDiscount: totalOfferDiscount,
    couponResult,
    deliveryCharge,
    isFreeDelivery,
    gstRate,
    gstAmount,
    totalPrice,
  };
}

module.exports = { computeOrderPricing, OrderPricingError };
