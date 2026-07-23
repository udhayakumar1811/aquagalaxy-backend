const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const upload = require("./middleware/uploadMiddleware");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Serve static uploads folder for image access
app.use("/uploads", express.static(path.join(__dirname, "/uploads")));

// IMAGE UPLOAD ROUTE
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (req.file) {
    res.status(200).json({
      message: "Image uploaded successfully",
      filePath: req.file.path.replace(/\\/g, "/"),
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