const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const router = express.Router();

// 1. Cloudinary Config Setup
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "duuxqxeh",
  api_key: process.env.CLOUDINARY_API_KEY || "367981587735996",
  api_secret: process.env.CLOUDINARY_API_SECRET || "3wT5RrUU514dhtfWCBb1Yy1tDQw",
});

// 2. Configure Cloudinary Storage Engine for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "aquagalaxy_uploads", // Cloudinary-ல் இந்த Folder-க்குள் Images சேமிக்கப்படும்
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5000000 }, // 5MB Limit
});

// 3. POST /api/upload Route
router.post("/", (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    // Cloudinary Secure Permanent HTTPS Image URL
    res.status(200).json({
      message: "Image uploaded successfully to Cloudinary",
      filePath: req.file.path, // req.file.path-ல் நேரடியா Cloudinary HTTPS URL இருக்கும்!
    });
  });
});

module.exports = router;