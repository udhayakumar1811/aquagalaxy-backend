const Category = require("../models/categoryModel");
const Product = require("../models/productModel");

// GET ALL CATEGORIES WITH DYNAMIC COUNT
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({ category_id: cat._id });
        return { ...cat._doc, count };
      })
    );
    res.status(200).json(categoriesWithCount);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch categories" });
  }
};

// GET SINGLE CATEGORY
const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch category" });
  }
};

// CREATE CATEGORY
const createCategory = async (req, res) => {
  try {
    const { name, image, isCategory } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }
    if (!image || !image.trim()) {
      return res.status(400).json({ message: "Category image is required" });
    }

    const category = await Category.create({
      name: name.trim(),
      image: image.trim(),
      isCategory: isCategory !== undefined ? isCategory : true,
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to create category" });
  }
};

// UPDATE CATEGORY
const updateCategory = async (req, res) => {
  try {
    const { name, image, isCategory } = req.body;
    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: "Category name cannot be empty" });
      updateData.name = name.trim();
    }
    if (image !== undefined) {
      if (!image.trim()) return res.status(400).json({ message: "Category image cannot be empty" });
      updateData.image = image.trim();
    }
    if (isCategory !== undefined) {
      updateData.isCategory = isCategory;
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to update category" });
  }
};

// DELETE CATEGORY
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    // Check if any product references this category
    const associatedProducts = await Product.countDocuments({ category_id: category._id });
    if (associatedProducts > 0) {
      return res.status(400).json({
        message: `Cannot delete category: ${associatedProducts} product(s) are currently assigned to it. Reassign or delete them first.`,
      });
    }

    await category.deleteOne();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete category" });
  }
};

// ⚠️ Check exports! All functions MUST be exported here.
module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};