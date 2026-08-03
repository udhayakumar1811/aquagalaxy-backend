const Product = require("../models/productModel"); // Check path correctly

// @desc    Get All Products
// @route   GET /api/products
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({}).populate("category_id", "name");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Product By ID
// @route   GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category_id", "name");
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create New Product
// @route   POST /api/products
const createProduct = async (req, res) => {
  try {
    const { category_id, name, price, qnt, image, desc } = req.body;
    const product = new Product({
      category_id,
      name,
      price,
      qnt,
      image,
      desc,
    });
    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update Product
// @route   PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const { category_id, name, price, qnt, image, desc } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      product.category_id = category_id || product.category_id;
      product.name = name || product.name;
      product.price = price !== undefined ? price : product.price;
      product.qnt = qnt !== undefined ? qnt : product.qnt;
      product.image = image || product.image;
      product.desc = desc || product.desc;

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete Product
// @route   DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      await Product.findByIdAndDelete(req.params.id);
      res.json({ message: "Product deleted successfully" });
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🎯 MUST EXPORT ALL FUNCTIONS CORRECTLY
module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};