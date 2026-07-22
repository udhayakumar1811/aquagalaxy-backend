const Product = require("../models/productModel");
const Category = require("../models/categoryModel"); // 👈 Category Model Import

// GET ALL PRODUCTS (WITH OPTIONAL CATEGORY FILTER)
const getProducts = async (req, res) => {
  try {
    const { category } = req.query;

    let filter = {};
    if (category) {
      filter.category_id = category;
    }

    const products = await Product.find(filter).populate("category_id", "name");
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

// CREATE PRODUCT (AUTO CATEGORY LINK BY NAME) 🚀
const createProduct = async (req, res) => {
  try {
    const { categoryName, image, name, price, qnt, desc } = req.body;

    // 1. Name vachu Category Exist-a nu check panrom
    let category = await Category.findOne({ name: categoryName });

    // 2. Oru velai Category illana, Dynamic-a Pudhu Category-a create panrom
    if (!category && categoryName) {
      category = await Category.create({
        name: categoryName,
        image: image, // Default product image set aagum
        isCategory: true,
      });
    }

    // 3. Automatic-a Category ID-a Product kooda map panrom
    const product = await Product.create({
      category_id: category ? category._id : null,
      image,
      name,
      price,
      qnt,
      desc,
    });

    res.status(201).json(product);
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
    );

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