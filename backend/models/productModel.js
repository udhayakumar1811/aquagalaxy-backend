const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // which order this review is verified against
  verifiedPurchase: { type: Boolean, default: false },
  rating: { type: Number, required: true },
  comment: { type: String, required: true },
}, { timestamps: true });

// Optional aquarium/fish-specific specifications. Left entirely optional
// so non-fish accessories (tanks, filters, food, decorations...) simply
// omit this object.
const fishInfoSchema = new mongoose.Schema({
  scientificName: { type: String },
  size: { type: String },
  gender: { type: String },
  age: { type: String },
  waterTemperature: { type: String },
  ph: { type: String },
  recommendedTankSize: { type: String },
  food: { type: String },
  difficultyLevel: { type: String, enum: ["Easy", "Moderate", "Difficult", null], default: null },
  compatibility: { type: String },
  lifespan: { type: String },
  breedingInfo: { type: String },
  careInfo: { type: String },
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // URL-friendly identifier, auto-generated from name if not supplied.
    // Not required/unique-enforced-strictly on legacy documents (sparse),
    // so existing products created before this field existed keep working.
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    productType: {
      type: String,
      enum: [
        "fish", "tank", "filter", "air_pump", "food", "plant",
        "decoration", "breeding_box", "net", "light", "accessory",
      ],
      default: "accessory",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPrice: {
      type: Number,
      default: null,
      validate: {
        validator: function (v) {
          return v == null || v < this.price;
        },
        message: "Discount price must be less than the regular price",
      },
    },
    qnt: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      default: "piece", // e.g. "piece", "pair" — used by the delivery calculator for fish
    },

    // Main image kept as its own required field for backward compatibility
    // with all existing frontend code that reads product.image directly.
    image: {
      type: String,
      required: true,
    },
    // Additional gallery images (optional)
    images: {
      type: [String],
      default: [],
    },
    video: { type: String, default: null },
    videoThumbnail: { type: String, default: null },

    desc: { type: String },
    shortDesc: { type: String },

    fishInfo: { type: fishInfoSchema, default: undefined },

    isActive: { type: Boolean, default: true },

    reviews: [reviewSchema],
    rating: {
      type: Number,
      required: true,
      default: 0,
    },
    numReviews: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate a unique slug from the product name whenever it's missing
// or the name changes. Keeps working for legacy documents that never had
// a slug (they simply get one assigned on their next save()).
//
// Mongoose 9.x does NOT pass a `next` callback to an async pre-hook — an
// async function signals completion via the promise it returns, not via
// calling next(). The previous version declared `async function (next)`
// and then called next() anyway, which throws "TypeError: next is not a
// function" (next is undefined here) the moment this hook runs — i.e. on
// every product save. Removing the next param/call is the fix; the actual
// slug-generation logic below is unchanged.
productSchema.pre("save", async function () {
  if (this.isModified("name") || !this.slug) {
    const base = this.name
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    let candidate = base;
    let counter = 1;
    const Product = this.constructor;

    // Ensure uniqueness by appending -2, -3, etc. if needed
    while (
      await Product.findOne({ slug: candidate, _id: { $ne: this._id } })
    ) {
      counter += 1;
      candidate = `${base}-${counter}`;
    }
    this.slug = candidate;
  }
});

productSchema.index({ name: "text", desc: "text", "fishInfo.scientificName": "text" });
productSchema.index({ category_id: 1 });
productSchema.index({ qnt: 1 });
productSchema.index({ productType: 1 });

module.exports = mongoose.model("Product", productSchema);
