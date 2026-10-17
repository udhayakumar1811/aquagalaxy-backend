const mongoose = require("mongoose");

// Singleton document — there is always exactly one Settings record.
// Everything here is admin-configurable through /api/settings so that
// business details (WhatsApp number, UPI ID, GST rate, etc.) are never
// hardcoded in source code.
const settingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "main", unique: true },

    website: {
      name: { type: String, default: "UDHAYA AQUATICS" },
      ownerName: { type: String, default: "UDHAYAKUMAR" },
      contactEmail: { type: String, default: "udhaya.aqua.pets@gmail.com" },
      contactPhone: { type: String, default: "6381582969" },
      address: { type: String, default: "Rajapalayam, Virudhunagar District" },
      city: { type: String, default: "Rajapalayam" },
      district: { type: String, default: "Virudhunagar" },
      state: { type: String, default: "Tamil Nadu" },
      country: { type: String, default: "India" },
      pincode: { type: String, default: "626117" },
      businessHours: { type: String, default: "7:00 AM – 9:00 PM" },
      socialLinks: {
        facebook: { type: String, default: "https://www.facebook.com/share/1DYndWGcjC/" },
        instagram: { type: String, default: "https://www.instagram.com/invites/contact/?utm_source=ig_contact_invite&utm_medium=copy_link&utm_content=j0ccj2u" },
        youtube: { type: String, default: "https://www.youtube.com/@Udhaya_Aquatics" },
        whatsappGroup: { type: String, default: "https://chat.whatsapp.com/Bb4FI0WOsYgBKxHoTOQ8u4" },
      },
    },

    whatsapp: {
      adminNumber: { type: String, default: "6381582969" }, // seeded default, admin-editable
      customerNotificationsEnabled: { type: Boolean, default: false },
      // Filled in once Meta WhatsApp Business Cloud API is configured (Track F)
      accessTokenConfigured: { type: Boolean, default: false },
      phoneNumberId: { type: String, default: "" },
    },

    payment: {
      razorpayEnabled: { type: Boolean, default: false }, // flips true once real keys exist
      upiId: { type: String, default: "" },
      upiQrImage: { type: String, default: "" },
      upiDisplayName: { type: String, default: "UDHAYA AQUATICS" },
      bankAccountName: { type: String, default: "UDHAYAKUMAR" },
      bankAccountNumber: { type: String, default: "" },
      bankIfsc: { type: String, default: "" },
      bankName: { type: String, default: "" },
    },

    tax: {
      gstEnabled: { type: Boolean, default: false },
      gstRate: { type: Number, default: 0 }, // percentage, e.g. 18
      gstNumber: { type: String, default: "" },
    },

    notifications: {
      emailEnabled: { type: Boolean, default: false },
      whatsappOrderAlerts: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// Helper so controllers never have to worry about the singleton not existing yet
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ singleton: "main" });
  if (!settings) {
    settings = await this.create({ singleton: "main" });
  }
  return settings;
};

module.exports = mongoose.model("Settings", settingsSchema);
