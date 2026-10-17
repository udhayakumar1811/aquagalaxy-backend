const Offer = require("../models/offerModel");
const Coupon = require("../models/couponModel");
const Order = require("../models/orderModel");

// ---------------------------------------------------------------------------
// OFFER/COUPON PRIORITY RULE (Section 20 requires this to be explicit):
//
// 1. For each cart item, find every currently-active Offer that matches
//    either that exact product OR its category. If more than one matches,
//    the offer giving the LARGEST discount for that item wins — offers
//    never stack on top of each other for the same item.
// 2. The coupon (if any) is applied AFTER offers, on the offer-adjusted
//    subtotal — coupon and offer discounts both apply, but only one offer
//    per item and only one coupon per order.
// 3. Nothing can push a total below zero at any stage.
// ---------------------------------------------------------------------------

function computeDiscount(discountType, discountValue, maxDiscount, base) {
  let discount = discountType === "percentage" ? (base * discountValue) / 100 : discountValue;
  if (maxDiscount != null) discount = Math.min(discount, maxDiscount);
  return Math.min(discount, base); // never exceed the amount being discounted
}

/**
 * Resolve automatic offers for each order item.
 * @param {Array} items - [{ product: ObjectId, category_id: ObjectId, lineTotal: number }]
 * @returns {Promise<{ totalOfferDiscount: number, anyFreeDelivery: boolean }>}
 */
async function resolveOffers(items) {
  const now = new Date();
  const productIds = items.map((i) => i.product);
  const categoryIds = items.map((i) => i.category_id).filter(Boolean);

  const offers = await Offer.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { product: { $in: productIds } },
      { category: { $in: categoryIds } },
    ],
  });

  let totalOfferDiscount = 0;
  let anyFreeDelivery = false;

  for (const item of items) {
    const matchingOffers = offers.filter(
      (o) =>
        (o.product && String(o.product) === String(item.product)) ||
        (o.category && String(o.category) === String(item.category_id))
    );

    if (matchingOffers.length === 0) continue;

    // Pick the single best offer for this item (largest resulting discount)
    let bestDiscount = 0;
    let bestOfferFreeDelivery = false;
    for (const offer of matchingOffers) {
      const discount = computeDiscount(offer.discountType, offer.discountValue, offer.maxDiscount, item.lineTotal);
      if (discount > bestDiscount) {
        bestDiscount = discount;
        bestOfferFreeDelivery = offer.freeDelivery;
      }
    }

    totalOfferDiscount += bestDiscount;
    if (bestOfferFreeDelivery) anyFreeDelivery = true;
  }

  return { totalOfferDiscount: Math.round(totalOfferDiscount), anyFreeDelivery };
}

/**
 * Validate and resolve a coupon code server-side. Never trusts a
 * client-computed discount value — recalculates everything here.
 * @param {string} code
 * @param {number} subtotalAfterOffers - the amount the coupon discount applies to
 * @param {string|null} userId
 * @param {Array} items - [{ product, category_id }]
 * @returns {Promise<{ valid: boolean, message: string, discount: number, freeDelivery: boolean, coupon: Object|null }>}
 */
async function resolveCoupon(code, subtotalAfterOffers, userId, items) {
  if (!code) return { valid: false, message: "", discount: 0, freeDelivery: false, coupon: null };

  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase(), isActive: true });
  if (!coupon) {
    return { valid: false, message: "Invalid or expired coupon code", discount: 0, freeDelivery: false, coupon: null };
  }

  const now = new Date();
  if (now < coupon.startDate || now > coupon.expiryDate) {
    return { valid: false, message: "This coupon is not currently active", discount: 0, freeDelivery: false, coupon: null };
  }

  if (subtotalAfterOffers < coupon.minOrderValue) {
    return {
      valid: false,
      message: `Minimum order value for this coupon is ₹${coupon.minOrderValue}`,
      discount: 0, freeDelivery: false, coupon: null,
    };
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: "This coupon has reached its usage limit", discount: 0, freeDelivery: false, coupon: null };
  }

  if (userId && coupon.perUserLimit != null) {
    const userUsageCount = await Order.countDocuments({
      user: userId,
      "pricing.couponCode": coupon.code,
      status: { $nin: ["Cancelled", "Payment Failed"] },
    });
    if (userUsageCount >= coupon.perUserLimit) {
      return { valid: false, message: "You have already used this coupon the maximum number of times", discount: 0, freeDelivery: false, coupon: null };
    }
  }

  // Product/category restriction
  if (coupon.applicableProducts.length > 0 || coupon.applicableCategories.length > 0) {
    const hasMatch = items.some(
      (item) =>
        coupon.applicableProducts.some((p) => String(p) === String(item.product)) ||
        coupon.applicableCategories.some((c) => String(c) === String(item.category_id))
    );
    if (!hasMatch) {
      return { valid: false, message: "This coupon doesn't apply to any items in your cart", discount: 0, freeDelivery: false, coupon: null };
    }
  }

  const discount = Math.round(computeDiscount(coupon.discountType, coupon.discountValue, coupon.maxDiscount, subtotalAfterOffers));

  return { valid: true, message: "Coupon applied", discount, freeDelivery: coupon.freeDelivery, coupon };
}

module.exports = { resolveOffers, resolveCoupon };
