const mongoose = require("mongoose");

const bannerSchema = mongoose.Schema(
  {
    title: { type: String, required: true, default: "50% OFF" },
    subtitle: { type: String, required: true, default: "Premium Aquarium Fish" },
    description: { type: String, required: true, default: "Get healthy and beautiful aquarium fish at the best price." },
    image: { type: String, required: true },
    endDate: { type: Date, required: true }, // டைமர் முடிவுறும் தேதி
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Banner", bannerSchema);