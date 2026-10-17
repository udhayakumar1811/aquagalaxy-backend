const mongoose = require("mongoose");

const gallerySchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true, default: "Aquarium Setup" },
    description: { type: String, required: true, default: "Detailed overview of this aquarium project and setup specifications." }, // 👈 Added Description
    image: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Gallery", gallerySchema);