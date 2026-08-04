const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();

// Storage Engine
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

// Check File Type
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
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

// POST /api/upload
router.post("/", (req, res) => {
  upload.single("image")(req, res, (err) => {
    // Multer validation or size error catching
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    // Windows / Linux path backward slash-ஐ clean செய்து Return செய்யப்படுகிறது
    const normalizedPath = req.file.path.replace(/\\/g, "/");

    res.status(200).json({
      message: "Image uploaded successfully",
      filePath: normalizedPath,
    });
  });
});

module.exports = router;