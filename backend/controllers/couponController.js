const Coupon = require("../models/couponModel");
const Product = require("../models/productModel");
const { resolveCoupon, resolveOffers } = require("../utils/pricingEngine");
const { logAdminAction } = require("../utils/auditLog");

// @desc    Preview a coupon's discount before placing the order (used by
//          the Checkout page's "Apply Coupon" button). The SAME validation
//          runs again, authoritatively, inside orderController.addOrderItems
//          — this endpoint is a convenience preview only, never trusted for
//          the actual order total.
// @route   POST /api/coupons/validate
// @access  Public
const validateCouponPreview = async (req, res) => {
  try {
    const { code, cartItems } = req.body;
    if (!code || !cartItems || cartItems.length === 0) {
      return res.status(400).json({ valid: false, message: "Coupon code and cart items are required" });
    }

    const productIds = cartItems.map((i) => i.product);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const items = cartItems.map((i) => {
      const p = productMap.get(String(i.product));
      const unitPrice = p ? (p.discountPrice ?? p.price) : 0;
      return {
        product: i.product,
        category_id: p?.category_id,
        lineTotal: unitPrice * (i.quantity || 1),
      };
    });

    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const { totalOfferDiscount } = await resolveOffers(items);
    const subtotalAfterOffers = Math.max(0, subtotal - totalOfferDiscount);

    const userId = req.user ? req.user._id : null;
    const result = await resolveCoupon(code, subtotalAfterOffers, userId, items);

    res.json(result);
  } catch (error) {
    console.error("Coupon Validate Error:", error);
    res.status(500).json({ valid: false, message: "Server error validating coupon" });
  }
};

// @desc    List all coupons
// @route   GET /api/coupons/admin
// @access  Private/Admin
const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create a coupon
// @route   POST /api/coupons/admin
// @access  Private/Admin
const createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create({
      ...req.body,
      code: req.body.code?.trim().toUpperCase(),
    });
    logAdminAction(req.user, "coupon.created", coupon.code, { discountType: coupon.discountType, discountValue: coupon.discountValue });
    res.status(201).json(coupon);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "A coupon with this code already exists" });
    }
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Update a coupon
// @route   PUT /api/coupons/admin/:id
// @access  Private/Admin
const updateCoupon = async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.code) update.code = update.code.trim().toUpperCase();

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json(coupon);
  } catch (error) {
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Delete a coupon
// @route   DELETE /api/coupons/admin/:id
// @access  Private/Admin
const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json({ message: "Coupon deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  validateCouponPreview,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
