const Product = require("../models/productModel");
const Category = require("../models/categoryModel");

// GET ALL PRODUCTS WITH POPULATED CATEGORY NAME 🚀
const getProducts = async (req, res) => {
  try {
    const { category } = req.query;

    let filter = {};
    if (category) {
      filter.category_id = category;
    }

    const products = await Product.find(filter)
      .populate("category_id", "name")
      .sort({ createdAt: -1 });

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET SINGLE PRODUCT
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category_id", "name");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE PRODUCT WITH MANDATORY CATEGORY & POPULATION 🚀
const createProduct = async (req, res) => {
  try {
    const { category_id, image, name, price, qnt, desc } = req.body;

    if (!category_id) {
      return res.status(400).json({ message: "Category ID is required!" });
    }

    const newProduct = await Product.create({
      category_id,
      image,
      name,
      price,
      qnt,
      desc,
    });

    const populatedProduct = await Product.findById(newProduct._id).populate("category_id", "name");

    res.status(201).json(populatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// UPDATE PRODUCT
const updateProduct = async (req, res) => {
  try {
    const { category_id, image, name, price, qnt, desc } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { category_id, image, name, price, qnt, desc },
      { new: true, runValidators: true }
    ).populate("category_id", "name");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE PRODUCT
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await product.deleteOne();

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};