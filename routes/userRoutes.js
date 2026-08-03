const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();

// Configure Storage
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "uploads/");
  },
  filename(req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

// File Type Validation
function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Images only! (jpg, jpeg, png, webp)"));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 5000000 }, // 5MB max
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

// Upload Single File Route
router.post("/", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image file uploaded" });
  }
  // Standardize path with forward slashes for cross-platform
  const normalizedPath = req.file.path.replace(/\\/g, "/");
  res.status(200).json({
    message: "Image uploaded successfully",
    filePath: normalizedPath,
  });
});

module.exports = router;