const Offer = require("../models/offerModel");

// @desc    Get currently active offers (for storefront badges/banners)
// @route   GET /api/offers/active
// @access  Public
const getActiveOffers = async (req, res) => {
  try {
    const now = new Date();
    const offers = await Offer.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).populate("product", "name").populate("category", "name");
    res.json(offers);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    List all offers (admin)
// @route   GET /api/offers/admin
// @access  Private/Admin
const getOffers = async (req, res) => {
  try {
    const offers = await Offer.find({}).populate("product", "name").populate("category", "name").sort({ createdAt: -1 });
    res.json(offers);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create an offer
// @route   POST /api/offers/admin
// @access  Private/Admin
const createOffer = async (req, res) => {
  try {
    if (!req.body.product && !req.body.category) {
      return res.status(400).json({ message: "An offer must target either a product or a category" });
    }
    const offer = await Offer.create(req.body);
    res.status(201).json(offer);
  } catch (error) {
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Update an offer
// @route   PUT /api/offers/admin/:id
// @access  Private/Admin
const updateOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!offer) return res.status(404).json({ message: "Offer not found" });
    res.json(offer);
  } catch (error) {
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Delete an offer
// @route   DELETE /api/offers/admin/:id
// @access  Private/Admin
const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return res.status(404).json({ message: "Offer not found" });
    res.json({ message: "Offer deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getActiveOffers, getOffers, createOffer, updateOffer, deleteOffer };
