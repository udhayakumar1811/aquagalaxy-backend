const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: false, // Optional if some products don't have category yet
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    qnt: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    desc: {
      type: String,
      default: "No description available",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);