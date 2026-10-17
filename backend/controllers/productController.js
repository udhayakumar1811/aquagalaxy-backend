const Product = require("../models/productModel");
const Order = require("../models/orderModel");
const { logAdminAction } = require("../utils/auditLog");
const { hasPermission } = require("../middleware/rbac");

// @desc    Get products with search/filter/sort/pagination (Section 8)
// @route   GET /api/products
// @access  Public — EXCEPT includeInactive=true, which requires an
// authenticated user with the "products.manage" permission (see the check
// below). Route uses `optionalAuth` (not `protect`) so a normal anonymous
// shopper request still succeeds; only the inactive-product branch checks
// req.user at all. This closes an information-disclosure gap where anyone
// could pass includeInactive=true and enumerate hidden/discontinued
// products — normal public listing behavior is completely unchanged.
// Query params: search, category, productType, minPrice, maxPrice,
// inStock (true/false), sort (price_asc|price_desc|newest|rating), page, limit
const getProducts = async (req, res) => {
  try {
    const {
      search, category, productType, minPrice, maxPrice, inStock,
      sort, page = 1, limit = 24, includeInactive,
    } = req.query;

    const wantsInactive = includeInactive === "true";
    if (wantsInactive && !hasPermission(req.user, "products.manage")) {
      return res.status(403).json({ message: "Not authorized to view inactive products" });
    }

    const filter = {};
    if (!wantsInactive) {
      filter.isActive = true;
    }

    if (search) {
      filter.$text = { $search: search };
    }
    if (category) filter.category_id = category;
    if (productType) filter.productType = productType;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (inStock === "true") filter.qnt = { $gt: 0 };
    if (inStock === "false") filter.qnt = 0;

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    if (sort === "price_desc") sortOption = { price: -1 };
    if (sort === "rating") sortOption = { rating: -1 };
    if (sort === "name_asc") sortOption = { name: 1 };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category_id", "name")
        .sort(sortOption)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      products,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Get Product By ID or slug
// @route   GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const product = await Product.findOne(
      isObjectId ? { _id: id } : { slug: id }
    ).populate("category_id", "name");

    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// Fields an admin is allowed to set. Keeping this list explicit (rather than
// spreading req.body directly onto the document) prevents unexpected/extra
// fields from being written.
const ASSIGNABLE_FIELDS = [
  "category_id", "name", "sku", "productType", "price", "discountPrice",
  "qnt", "unit", "image", "images", "video", "videoThumbnail",
  "desc", "shortDesc", "fishInfo", "isActive",
];

// @desc    Create New Product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    const data = {};
    for (const field of ASSIGNABLE_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    if (!data.category_id || !data.name || data.price === undefined || !data.image) {
      return res.status(400).json({ message: "category_id, name, price and image are required" });
    }

    const product = new Product(data);
    const createdProduct = await product.save();
    logAdminAction(req.user, "product.created", createdProduct.name, { productId: createdProduct._id, price: createdProduct.price });
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Update Product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const stockBefore = product.qnt;

    for (const field of ASSIGNABLE_FIELDS) {
      if (req.body[field] !== undefined) product[field] = req.body[field];
    }

    const updatedProduct = await product.save();

    if (req.body.qnt !== undefined && req.body.qnt !== stockBefore) {
      logAdminAction(req.user, "product.stock_changed", updatedProduct.name, {
        productId: updatedProduct._id, from: stockBefore, to: updatedProduct.qnt,
      });
    } else {
      logAdminAction(req.user, "product.updated", updatedProduct.name, { productId: updatedProduct._id });
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Delete Product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      await Product.findByIdAndDelete(req.params.id);
      logAdminAction(req.user, "product.deleted", product.name, { productId: product._id });
      res.json({ message: "Product deleted successfully" });
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Create New Review — VERIFIED PURCHASE ONLY (Section 10).
//          A review is only accepted if the authenticated user has a
//          Delivered order that contains this exact product. Product ID,
//          user identity and purchase status are never trusted from the
//          client — purchase status is looked up server-side against the
//          Order collection.
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const numericRating = Number(rating);

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: "Please write a comment" });
    }
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const alreadyReviewed = product.reviews.some(
      (r) => String(r.user) === String(req.user._id)
    );
    if (alreadyReviewed) {
      return res.status(400).json({ message: "You have already reviewed this product" });
    }

    // Look up a Delivered order for this user containing this product.
    const qualifyingOrder = await Order.findOne({
      user: req.user._id,
      status: "Delivered",
      "orderItems.product": product._id,
    });

    if (!qualifyingOrder) {
      return res.status(403).json({
        message: "You can only review products you have purchased and received.",
      });
    }

    const review = {
      name: req.user.name,
      user: req.user._id,
      order: qualifyingOrder._id,
      verifiedPurchase: true,
      rating: numericRating,
      comment: comment.trim(),
    };

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    product.rating =
      product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();
    res.status(201).json({ message: "Review added successfully" });
  } catch (error) {
    res.status(400).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

// @desc    Admin: delete an inappropriate review
// @route   DELETE /api/products/:id/reviews/:reviewId
// @access  Private/Admin
const deleteProductReview = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.reviews = product.reviews.filter(
      (r) => String(r._id) !== req.params.reviewId
    );
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.length
      ? product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length
      : 0;

    await product.save();
    res.json({ message: "Review removed" });
  } catch (error) {
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  deleteProductReview,
};
