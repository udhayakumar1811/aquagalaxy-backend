const Gallery = require("../models/galleryModel");

// @desc    Get all gallery items
// @route   GET /api/gallery
// @access  Public
const getGalleryItems = async (req, res) => {
  try {
    const items = await Gallery.find({}).sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a gallery item (Admin)
// @route   POST /api/gallery
// @access  Private/Admin
const addGalleryItem = async (req, res) => {
  try {
    const { name, category, image } = req.body;

    if (!name || !image) {
      return res.status(400).json({ message: "Please provide name and image" });
    }

    const item = await Gallery.create({
      name,
      category: category || "Aquarium Setup",
      image,
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a gallery item (Admin)
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
const deleteGalleryItem = async (req, res) => {
  try {
    const item = await Gallery.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Gallery item not found" });
    }

    await item.deleteOne();
    res.json({ message: "Gallery item removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getGalleryItems, addGalleryItem, deleteGalleryItem };