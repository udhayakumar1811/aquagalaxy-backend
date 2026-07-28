const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// dotenv.config() MUST BE BEFORE connectDB() 🚀
dotenv.config();

const connectDB = require("./config/db");
connectDB();

const app = express();

// 🚀 Allow CORS for Vercel Frontend
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/category", require("./routes/categoryRoutes"));
app.use("/api/products", require("./routes/productRoutes"));

// Default Route for Health Check
app.get("/", (req, res) => {
  res.send("🚀 AquaGalaxy API is running smoothly!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));