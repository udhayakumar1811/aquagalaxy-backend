const express = require("express");
const router = express.Router();
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController"); // Check path
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

router.route("/")
  .get(getCategories)
  .post(protect, requirePermission("categories.manage"), createCategory);

router.route("/:id")
  .get(getCategory)
  .put(protect, requirePermission("categories.manage"), updateCategory)
  .delete(protect, requirePermission("categories.manage"), deleteCategory);

module.exports = router;