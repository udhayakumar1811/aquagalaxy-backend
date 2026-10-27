const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const sanitizeRequest = require("./middleware/sanitize");
const rateLimit = require("express-rate-limit");

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error(
    "❌ JWT_SECRET is not set. Add JWT_SECRET=<a long random string> to your .env file before starting the server."
  );
  process.exit(1);
}

const connectDB = require("./config/db");
connectDB();

const app = express();

// Security headers (Section 33) — sensible defaults for an API server.
app.use(helmet());

// ---------------------------------------------------------------------------
// CORS — Section 34 explicitly calls out `origin: "*"` as unacceptable for
// production. Allowed origins come from the environment: set
// CORS_ALLOWED_ORIGINS to a comma-separated list of exact origins (e.g.
// "https://aquagalaxy.com,https://www.aquagalaxy.com") in production. If
// unset, we fall back to common local dev origins only — NOT a wildcard.
// ---------------------------------------------------------------------------
const isProduction = process.env.NODE_ENV === "production";

// For local development, allow ONLY the specific local development frontend origins:
const devOrigins = [
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8082",
  "http://localhost:19006",
];

// Production origins must come strictly from environment configuration (CORS_ALLOWED_ORIGINS and/or FRONTEND_URL)
const envOrigins = [
  ...(process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(",") : []),
  process.env.FRONTEND_URL,
]
  .filter(Boolean)
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// In production, do NOT hardcode localhost. Use configured real domain(s).
// In development, merge the explicit local development origins with any configured env origins.
const allowedOrigins = Array.from(
  new Set(isProduction ? envOrigins : [...devOrigins, ...envOrigins])
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no Origin header — e.g. curl, mobile apps, health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Captures the raw request body bytes (req.rawBody) alongside normal JSON
// parsing. Needed for Razorpay webhook signature verification (Priority 2),
// which HMACs the exact raw bytes Razorpay sent — re-serializing the
// parsed JSON object would not reliably reproduce the same bytes (key
// ordering, whitespace), so the signature would fail even for a genuine
// webhook.
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

// Strip any keys starting with '$' or containing '.' from req.body/query/params
// to prevent NoSQL (MongoDB operator) injection (Section 33). Custom
// implementation — see middleware/sanitize.js for why the popular
// express-mongo-sanitize package doesn't work under Express 5.
app.use(sanitizeRequest);

// Brute-force / credential-stuffing protection on registration. Login has
// its own, tighter, dedicated limiter below (Prompt 1) — kept separate so
// changing login's limits never risks altering registration's behavior.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/users/register", authLimiter);

// --- Login rate limiting (Prompt 1, requirement #1): max 10 requests per
// IP per minute. This is IP-level throttling — separate from and in
// addition to the per-ACCOUNT lockout logic in authController.loginUser.
//
// NOTE ON PRODUCTION / MULTI-INSTANCE DEPLOYMENTS: this uses
// express-rate-limit's default in-memory store, which counts requests
// per Node process. That's correct and sufficient for local development
// and a single-instance deployment. If AquaGalaxy is ever deployed across
// MULTIPLE server instances behind a load balancer, each instance would
// enforce this limit independently — effectively multiplying the real
// allowed rate by the number of instances, since they don't share
// counters. At that point, swap the `store` option below for a shared
// backend (e.g. the `rate-limit-redis` package pointed at Redis/Upstash)
// so all instances share one counter. This project has no Redis/Upstash
// dependency today, so per instruction #9 this ships with the safe
// in-memory fallback rather than adding a new external service blind.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { message: "Too many login attempts. Please wait a minute and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/users/login", loginLimiter);

// Password reset requests must be rate-limited too (Prompt 1 continuation)
// — otherwise the endpoint becomes an email-bombing vector (spam reset
// emails to a victim) and, to a lesser extent, an account-enumeration
// timing channel. Separate from loginLimiter so tuning one never touches
// the other.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: "Too many password reset requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/users/forgot-password", forgotPasswordLimiter);
app.use("/api/users/reset-password", forgotPasswordLimiter);

// Order/payment creation reserves real stock immediately (see
// orderController.addOrderItems), even before payment is verified — so an
// unlimited, unauthenticated endpoint here is a stock-exhaustion DoS vector
// (an attacker could spam fake orders with garbage UTRs to lock up
// inventory). Rate-limited by IP; genuine customers won't hit this.
const orderCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { message: "Too many order attempts. Please try again shortly, or contact us if you're having trouble checking out." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/orders", (req, res, next) => {
  if (req.method === "POST" && req.path === "/") return orderCreationLimiter(req, res, next);
  next();
});
app.use("/api/payments/razorpay/create-order", orderCreationLimiter);

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "UDHAYA AQUATICS API is running" });
});

// Dynamic sitemap (Section 40) — see .env.example FRONTEND_URL, which
// must be set to your real production frontend domain for correct URLs.
app.get("/sitemap.xml", require("./controllers/sitemapController").getSitemap);

// Routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/category", require("./routes/categoryRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/banner", require("./routes/bannerRoutes"));
app.use("/api/gallery", require("./routes/galleryRoutes"));
app.use("/api/contact", require("./routes/contactRoutes"));
app.use("/api/contacts", require("./routes/contactRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/admin/users", require("./routes/adminUserRoutes"));
app.use("/api/delivery", require("./routes/deliveryRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/coupons", require("./routes/couponRoutes"));
app.use("/api/offers", require("./routes/offerRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/admin/analytics", require("./routes/analyticsRoutes"));
app.use("/api/admin/audit-logs", require("./routes/auditLogRoutes"));

// 404 handler for unknown API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API route not found" });
  }
  next();
});

// Central error handler (catches thrown/next(err) errors from routes).
// Never leak stack traces or internal details to the client (Section 50).
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Origin not allowed" });
  }

  // Ensure CORS headers are present on error responses for allowed origins
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : (err.message || "Server error"),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
