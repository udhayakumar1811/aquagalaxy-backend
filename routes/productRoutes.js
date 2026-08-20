const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview, // 👈 Imported from controller
} = require("../controllers/productController");
const { protect, admin } = require("../middleware/authMiddleware");

// Routes
router.route("/")
  .get(getProducts)
  .post(protect, admin, createProduct);

// Route to add a review (must be logged in)
router.route("/:id/reviews").post(protect, createProductReview);

router.route("/:id")
  .get(getProductById)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

module.exports = router;