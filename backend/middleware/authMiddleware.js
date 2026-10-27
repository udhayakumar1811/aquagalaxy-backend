const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { getJwtSecret } = require("../utils/generateToken");

// Authenticate User Token
const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer")) {
    try {
      const parts = authHeader.split(" ");
      token = parts[1];

      // Treat missing, blank, or stringified null/undefined as "no token"
      if (!token || token === "null" || token === "undefined" || token.trim() === "") {
        return res.status(401).json({ message: "Not authorized, no token" });
      }

      const decoded = jwt.verify(token, getJwtSecret());

      req.user = await User.findById(decoded.id).select("-password");
      if (!req.user) {
        return res.status(401).json({ message: "User not found" });
      }
      if (req.user.isDisabled) {
        return res.status(403).json({ message: "This account has been disabled" });
      }
      // A password reset bumps tokenVersion, so any token issued before it
      // (claim `v`, defaulting to 0 for tokens minted before this field
      // existed) is rejected here even though it hasn't expired yet.
      if ((decoded.v || 0) !== (req.user.tokenVersion || 0)) {
        return res.status(401).json({ message: "Token expired, please login again", expired: true, code: "TOKEN_REVOKED" });
      }
      return next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired, please login again", expired: true, code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ message: "Not authorized, token failed", code: "TOKEN_INVALID" });
    }
  }

  return res.status(401).json({ message: "Not authorized, no token" });
};

// Check if User has full admin access (admin or superadmin — both are
// full-privilege roles). For scoped roles (order_manager, product_manager,
// etc.) use requirePermission() from middleware/rbac.js instead.
const admin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
  if (req.user.role === "admin" || req.user.role === "superadmin") {
    next();
  } else {
    res.status(403).json({ message: "Not authorized as an admin" });
  }
};

// Populates req.user if a valid Bearer token is present, but — unlike
// `protect` — never rejects the request if it's absent or invalid. Used on
// routes that support BOTH guest and logged-in checkout (Section 9: "guest
// checkout" is implied by paymentMethod flows working without an account),
// so a logged-in customer's orders still get linked to their account while
// guests can still check out.
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return next();
  }
  try {
    const parts = authHeader.split(" ");
    const token = parts[1];
    if (!token || token === "null" || token === "undefined" || token.trim() === "") {
      return next();
    }
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id).select("-password");
    if (user && !user.isDisabled && (decoded.v || 0) === (user.tokenVersion || 0)) {
      req.user = user;
    }
  } catch (error) {
    // Invalid/expired token on an optional-auth route — proceed as guest
    // rather than failing the whole request.
  }
  next();
};

module.exports = { protect, admin, optionalAuth };
