const Settings = require("../models/settingsModel");
const { isRazorpayConfigured } = require("../utils/razorpayClient");
const { isEmailConfigured } = require("../utils/emailService");
const { isWhatsAppConfigured } = require("../utils/whatsappService");
const { isCourierConfigured } = require("../utils/courierService");
const { logAdminAction } = require("../utils/auditLog");

// @desc    Get PUBLIC-SAFE settings (for storefront: UPI display info,
//          WhatsApp number for "chat with us" links, GST display, and the
//          bank details a customer needs to complete a Bank Transfer order.
//          None of this is a secret — it's the same info a business would
//          print on an invoice. Actual secrets (API keys/tokens) never
//          appear in this response.
// @route   GET /api/settings/public
// @access  Public
const getPublicSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      website: settings.website,
      whatsapp: {
        adminNumber: settings.whatsapp.adminNumber,
      },
      payment: {
        razorpayEnabled: isRazorpayConfigured(),
        upiId: settings.payment.upiId,
        upiQrImage: settings.payment.upiQrImage,
        upiDisplayName: settings.payment.upiDisplayName,
        bankAccountName: settings.payment.bankAccountName,
        bankAccountNumber: settings.payment.bankAccountNumber,
        bankIfsc: settings.payment.bankIfsc,
        bankName: settings.payment.bankName,
      },
      tax: {
        gstEnabled: settings.tax.gstEnabled,
        gstRate: settings.tax.gstRate,
        gstNumber: settings.tax.gstNumber,
      },
    });
  } catch (error) {
    console.error("Get Public Settings Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get FULL settings for the admin panel
// @route   GET /api/settings/admin
// @access  Private/Admin
const getAdminSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      ...settings.toObject(),
      integrationStatus: {
        razorpayConfigured: isRazorpayConfigured(),
        emailConfigured: isEmailConfigured(),
        whatsappConfigured: isWhatsAppConfigured(),
        courierConfigured: isCourierConfigured(),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update settings (any subset of fields)
// @route   PUT /api/settings/admin
// @access  Private/Admin
const updateAdminSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const oldWhatsappNumber = settings.whatsapp.adminNumber;

    // Deep-merge each top-level section so a partial update from the admin
    // UI doesn't wipe out fields it didn't send.
    const sections = ["website", "whatsapp", "payment", "tax", "notifications"];
    for (const section of sections) {
      if (req.body[section]) {
        settings[section] = { ...settings[section].toObject(), ...req.body[section] };
      }
    }

    const updated = await settings.save();

    if (req.body.whatsapp?.adminNumber && req.body.whatsapp.adminNumber !== oldWhatsappNumber) {
      logAdminAction(req.user, "settings.whatsapp_number_changed", updated.whatsapp.adminNumber, {
        from: oldWhatsappNumber, to: updated.whatsapp.adminNumber,
      });
    }
    for (const section of sections) {
      if (req.body[section] && !(section === "whatsapp" && req.body.whatsapp?.adminNumber)) {
        logAdminAction(req.user, `settings.${section}_updated`, section, {});
      }
    }

    res.json(updated);
  } catch (error) {
    console.error("Update Settings Error:", error);
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

module.exports = { getPublicSettings, getAdminSettings, updateAdminSettings };
