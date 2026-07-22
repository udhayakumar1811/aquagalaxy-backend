const Category = require("../models/categoryModel");
const Product = require("../models/productModel");

// GET ALL CATEGORIES WITH DYNAMIC PRODUCT COUNT
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();

    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const productCount = await Product.countDocuments({ category_id: cat._id });
        return {
          ...cat._doc,
          count: productCount,
        };
      })
    );

    res.status(200).json(categoriesWithCount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET SINGLE CATEGORY WITH DYNAMIC COUNT
const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const productCount = await Product.countDocuments({ category_id: category._id });

    res.status(200).json({
      ...category._doc,
      count: productCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE CATEGORY
const createCategory = async (req, res) => {
  try {
    const { name, image, isCategory } = req.body;
    
    const category = await Category.create({
      name,
      image,
      isCategory,
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// UPDATE CATEGORY
const updateCategory = async (req, res) => {
  try {
    const { name, image, isCategory } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, image, isCategory },
      { new: true, runValidators: true }
    );
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE CATEGORY
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    await category.deleteOne();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};