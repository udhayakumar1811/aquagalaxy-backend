const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const rateLimit = require("express-rate-limit");
const { protect } = require("../middleware/authMiddleware");
const { requireAnyPermission, requirePermission } = require("../middleware/rbac");
const router = express.Router();

// 1. Cloudinary Config Setup — credentials MUST come from the environment.
// No hardcoded fallback: committing real API keys as a fallback in source
// code means they leak to anyone who reads the code/repo.
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error(
    "❌ Cloudinary environment variables are missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in your .env file."
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Configure Cloudinary Storage Engines for Multer — product media,
// product video, and customer payment screenshots are kept in SEPARATE
// folders/routes (Section 36/37) so they can have different access rules.
const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "aquagalaxy_uploads",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

// Video storage — resource_type "video" is required for Cloudinary to
// treat these as videos (not images) for delivery/transformation purposes.
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "aquagalaxy_product_videos",
    resource_type: "video",
    allowed_formats: ["mp4", "mov", "webm"],
  },
});

// Payment screenshots — PRIVATE delivery type (Priority 3 / Section 37).
// type: "private" means Cloudinary will NOT serve these via a plain public
// URL; viewing them requires a signed URL generated server-side on demand
// by an authorized admin (see controllers/orderController.getPaymentScreenshotUrl
// and routes/orderRoutes.js). The upload response's secure_url is still
// returned here for convenience but is NOT the URL actually used to view
// the image later — only the stored public_id is used for that.
const screenshotStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "aquagalaxy_payment_screenshots",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    type: "private",
  },
});

const uploadProductImage = multer({
  storage: productStorage,
  limits: { fileSize: 5000000 }, // 5MB
});

// Multiple images at once — same storage/validation as the single-image
// route, just accepting an array field.
const uploadProductImages = multer({
  storage: productStorage,
  limits: { fileSize: 5000000, files: 8 }, // 5MB each, up to 8 images per request
});

// Video upload — validates MIME type AND extension server-side (never
// trust the client-reported MIME type alone; the extension check is a
// second, independent signal). Size capped at 25MB, which comfortably
// covers a well-compressed ~20-second promotional clip.
//
// IMPORTANT — what this validation does NOT do: it does not verify the
// actual video DURATION server-side (that would require a media-inspection
// tool like ffprobe, which isn't available in this environment). The
// "~20 seconds" requirement is enforced as admin guidance/UI copy, not a
// technical constraint. Documented here rather than silently unenforced.
const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];

const videoFileFilter = (req, file, cb) => {
  const ext = "." + file.originalname.split(".").pop().toLowerCase();
  const mimeOk = ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype);
  const extOk = ALLOWED_VIDEO_EXTENSIONS.includes(ext);
  if (!mimeOk || !extOk) {
    return cb(new Error("Only MP4, MOV, or WEBM video files are allowed"), false);
  }
  cb(null, true);
};

const uploadProductVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 25000000 }, // 25MB
  fileFilter: videoFileFilter,
});

const uploadScreenshot = multer({
  storage: screenshotStorage,
  limits: { fileSize: 3000000 }, // 3MB — screenshots don't need to be huge
});

// Payment screenshot uploads are reachable without login (guest checkout is
// supported), so rate-limit by IP to reduce abuse of this open endpoint.
const screenshotUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many upload attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const mediaUploadPermissions = ["products.manage", "categories.manage", "banner.manage", "gallery.manage"];

// 3. POST /api/upload Route (single image) — used by product_manager
// (product/category images) and content_manager (banner/gallery images).
router.post("/", protect, requireAnyPermission(mediaUploadPermissions), (req, res) => {
  uploadProductImage.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    res.status(200).json({
      message: "Image uploaded successfully to Cloudinary",
      filePath: req.file.path,
    });
  });
});

// 4. POST /api/upload/multiple — up to 8 product images in one request,
// for the multi-image gallery feature.
router.post("/multiple", protect, requireAnyPermission(mediaUploadPermissions), (req, res) => {
  uploadProductImages.array("images", 8)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No image files uploaded" });
    }

    res.status(200).json({
      message: `${req.files.length} image(s) uploaded successfully`,
      filePaths: req.files.map((f) => f.path),
    });
  });
});

// 5. POST /api/upload/video — product promotional video. Restricted to
// product_manager/admin/superadmin (products.manage) — content_manager and
// support_manager have no legitimate reason to upload product video.
router.post("/video", protect, requirePermission("products.manage"), (req, res) => {
  uploadProductVideo.single("video")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No video file uploaded" });
    }

    res.status(200).json({
      message: "Video uploaded successfully",
      filePath: req.file.path,
      // Cloudinary auto-generates a thumbnail for videos by swapping the
      // extension to .jpg on the same public_id — safe to construct here
      // since it's a deterministic Cloudinary convention, not a guess.
      thumbnailPath: req.file.path.replace(/\.(mp4|mov|webm)$/i, ".jpg"),
    });
  });
});

// 6. POST /api/upload/payment-screenshot — open to any customer (including
// guests) submitting a manual UPI/Bank Transfer order, kept in its own
// Cloudinary folder with PRIVATE delivery type and rate-limited since it
// doesn't require login. The returned filePath/secure_url will NOT work as
// a public link (private delivery) — it's stored on the order for record-
// keeping, but viewing it later goes through the signed-URL endpoint.
router.post("/payment-screenshot", screenshotUploadLimiter, (req, res) => {
  uploadScreenshot.single("screenshot")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No screenshot uploaded" });
    }

    res.status(200).json({
      message: "Screenshot uploaded successfully",
      filePath: req.file.path,
      publicId: req.file.filename, // multer-storage-cloudinary sets this to the Cloudinary public_id
    });
  });
});

module.exports = router;
