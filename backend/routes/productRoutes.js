const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  deleteProductReview,
} = require("../controllers/productController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

// Routes
router.route("/")
  .get(optionalAuth, getProducts)
  .post(protect, requirePermission("products.manage"), createProduct);

// Reviews
router.route("/:id/reviews").post(protect, createProductReview);
router.route("/:id/reviews/:reviewId").delete(protect, requirePermission("reviews.moderate"), deleteProductReview);

router.route("/:id")
  .get(getProductById)
  .put(protect, requirePermission("products.manage"), updateProduct)
  .delete(protect, requirePermission("products.manage"), deleteProduct);

module.exports = router;
