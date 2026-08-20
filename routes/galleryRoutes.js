const express = require("express");
const router = express.Router();
const {
  getGalleryItems,
  addGalleryItem,
  deleteGalleryItem,
} = require("../controllers/galleryController");
const { protect, admin } = require("../middleware/authMiddleware");

router.route("/").get(getGalleryItems).post(protect, admin, addGalleryItem);
router.route("/:id").delete(protect, admin, deleteGalleryItem);

module.exports = router;