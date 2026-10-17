const DeliveryRule = require("../models/deliveryRuleModel");

// Hardcoded fallback pricing (Section 17), used only when no admin
// DeliveryRule matches the destination:
//
//   Tamil Nadu:      1-3 pairs = ₹100, 4-6 pairs = ₹150,
//                    above 6 = +₹50 per additional 2 pairs
//   Other states:    first 2 pairs = ₹100, +₹50 per additional pair
const DEFAULT_TAMIL_NADU = {
  tiers: [
    { uptoQuantity: 3, charge: 100 },
    { uptoQuantity: 6, charge: 150 },
  ],
  beyondLastTier: { stepQuantity: 2, stepCharge: 50 },
};
const DEFAULT_OTHER_STATES = {
  tiers: [
    { uptoQuantity: 2, charge: 100 },
  ],
  beyondLastTier: { stepQuantity: 1, stepCharge: 50 },
};

/**
 * Compute delivery charge from a tiered pricing structure.
 * @param {number} quantity
 * @param {{tiers: {uptoQuantity:number, charge:number}[], beyondLastTier: {stepQuantity:number, stepCharge:number}}} pricing
 */
function computeTieredCharge(quantity, pricing) {
  const sortedTiers = [...pricing.tiers].sort((a, b) => a.uptoQuantity - b.uptoQuantity);

  for (const tier of sortedTiers) {
    if (quantity <= tier.uptoQuantity) {
      return tier.charge;
    }
  }

  // Beyond the last tier: charge the last tier's price plus a step charge
  // for every `stepQuantity` items past the last tier's threshold.
  const lastTier = sortedTiers[sortedTiers.length - 1];
  const { stepQuantity, stepCharge } = pricing.beyondLastTier;
  const extraQty = quantity - lastTier.uptoQuantity;
  const extraSteps = Math.ceil(extraQty / (stepQuantity || 1));
  return lastTier.charge + extraSteps * stepCharge;
}

/**
 * Calculate delivery charge for an order server-side.
 * @param {Object} params
 * @param {string} params.state
 * @param {string} params.pincode
 * @param {number} params.totalQuantity - total item quantity in the cart
 * @param {number} params.subtotal - cart subtotal, used for free-delivery thresholds
 * @returns {Promise<{ isServiceable: boolean, charge: number, isFreeDelivery: boolean, message: string }>}
 */
async function calculateDeliveryCharge({ state, pincode, totalQuantity, subtotal }) {
  if (!state || !totalQuantity) {
    return { isServiceable: false, charge: 0, isFreeDelivery: false, message: "State and quantity are required" };
  }

  // 1. Look for the most specific admin-configured rule: pincode match first,
  //    then state-wide rule.
  const pincodeRule = pincode
    ? await DeliveryRule.findOne({ state, pincode, isActive: true })
    : null;
  const stateRule = pincodeRule
    ? null
    : await DeliveryRule.findOne({ state, pincode: null, isActive: true });

  const rule = pincodeRule || stateRule;

  if (rule) {
    if (!rule.isServiceable) {
      return { isServiceable: false, charge: 0, isFreeDelivery: false, message: "Delivery is not currently available for this location" };
    }

    const forcedFree = rule.freeDelivery || (rule.freeDeliveryThreshold != null && subtotal >= rule.freeDeliveryThreshold);
    if (forcedFree) {
      return { isServiceable: true, charge: 0, isFreeDelivery: true, message: "Free delivery" };
    }

    // Defense in depth: the admin UI never lets `tiers` go below 1 entry,
    // but nothing server-side enforced that — a rule saved via a direct
    // API call with an empty tiers array would otherwise crash
    // computeTieredCharge() (lastTier would be undefined) for every
    // checkout at this state/pincode. Fail closed instead of throwing.
    if (!Array.isArray(rule.tiers) || rule.tiers.length === 0) {
      return { isServiceable: false, charge: 0, isFreeDelivery: false, message: "Delivery pricing is not configured correctly for this location. Please contact support." };
    }

    const charge = computeTieredCharge(totalQuantity, rule);
    return { isServiceable: true, charge, isFreeDelivery: false, message: "OK" };
  }

  // 2. No admin rule configured — fall back to the default hardcoded slabs
  //    from Section 17. All of India is covered by default unless an admin
  //    rule explicitly marks a location as not serviceable.
  const defaultPricing = state.trim().toLowerCase() === "tamil nadu" ? DEFAULT_TAMIL_NADU : DEFAULT_OTHER_STATES;
  const charge = computeTieredCharge(totalQuantity, defaultPricing);

  return { isServiceable: true, charge, isFreeDelivery: false, message: "OK (default rate)" };
}

module.exports = { calculateDeliveryCharge, computeTieredCharge };
