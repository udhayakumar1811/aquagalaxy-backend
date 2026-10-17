const DeliveryRule = require("../models/deliveryRuleModel");
const { calculateDeliveryCharge } = require("../utils/deliveryCalculator");

// @desc    Check delivery availability + charge for a destination
// @route   GET /api/delivery/check?state=&pincode=&quantity=&subtotal=
// @access  Public
const checkDelivery = async (req, res) => {
  try {
    const { state, pincode, quantity, subtotal } = req.query;

    if (!state || !quantity) {
      return res.status(400).json({ message: "state and quantity are required" });
    }

    const result = await calculateDeliveryCharge({
      state,
      pincode,
      totalQuantity: Number(quantity),
      subtotal: Number(subtotal) || 0,
    });

    res.json(result);
  } catch (error) {
    console.error("Delivery Check Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    List all delivery rules
// @route   GET /api/admin/delivery-rules
// @access  Private/Admin
const getDeliveryRules = async (req, res) => {
  try {
    const rules = await DeliveryRule.find({}).sort({ state: 1, pincode: 1 });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create a delivery rule
// @route   POST /api/admin/delivery-rules
// @access  Private/Admin
const createDeliveryRule = async (req, res) => {
  try {
    // Matches the admin UI's own guard (it never lets tiers go below 1) —
    // enforced here too since the UI isn't the real security/validation
    // boundary. See utils/deliveryCalculator.js for the matching runtime
    // guard against rules that already have an empty tiers array.
    if (req.body.tiers && (!Array.isArray(req.body.tiers) || req.body.tiers.length === 0)) {
      return res.status(400).json({ message: "At least one pricing tier is required" });
    }
    const rule = await DeliveryRule.create(req.body);
    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Update a delivery rule
// @route   PUT /api/admin/delivery-rules/:id
// @access  Private/Admin
const updateDeliveryRule = async (req, res) => {
  try {
    if (req.body.tiers && (!Array.isArray(req.body.tiers) || req.body.tiers.length === 0)) {
      return res.status(400).json({ message: "At least one pricing tier is required" });
    }
    const rule = await DeliveryRule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!rule) return res.status(404).json({ message: "Rule not found" });
    res.json(rule);
  } catch (error) {
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Delete a delivery rule
// @route   DELETE /api/admin/delivery-rules/:id
// @access  Private/Admin
const deleteDeliveryRule = async (req, res) => {
  try {
    const rule = await DeliveryRule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ message: "Rule not found" });
    res.json({ message: "Delivery rule deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  checkDelivery,
  getDeliveryRules,
  createDeliveryRule,
  updateDeliveryRule,
  deleteDeliveryRule,
};
