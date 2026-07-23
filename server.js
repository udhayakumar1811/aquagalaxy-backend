const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path"); // 👈 Path import
const connectDB = require("./config/db");
const upload = require("./middleware/uploadMiddleware"); // 👈 Upload middleware

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Make uploads folder publicly accessible for images 🚀
app.use("/uploads", express.static(path.join(__dirname, "/uploads")));

// IMAGE UPLOAD API ENDPOINT 📸
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (req.file) {
    res.status(200).json({
      message: "Image uploaded successfully",
      filePath: req.file.path.replace(/\\/g, "/"), // e.g. "uploads/image-12345.jpg"
    });
  } else {
    res.status(400).json({ message: "No image file provided" });
  }
});

// Routes
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/category", require("./routes/categoryRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));

app.get("/", (req, res) => {
  res.send("API Running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});