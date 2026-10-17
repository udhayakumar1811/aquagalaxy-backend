const express = require("express");
const router = express.Router();
const {
  getGalleryItems,
  addGalleryItem,
  deleteGalleryItem,
} = require("../controllers/galleryController");
const { protect } = require("../middleware/authMiddleware");
const { requirePermission } = require("../middleware/rbac");

router.route("/").get(getGalleryItems).post(protect, requirePermission("gallery.manage"), addGalleryItem);
router.route("/:id").delete(protect, requirePermission("gallery.manage"), deleteGalleryItem);

module.exports = router;