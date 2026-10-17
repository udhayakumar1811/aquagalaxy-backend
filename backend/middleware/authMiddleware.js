const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { getJwtSecret } = require("../utils/generateToken");

// Authenticate User Token
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
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
        return res.status(401).json({ message: "Not authorized, token failed" });
      }
      return next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

// Check if User has full admin access (admin or superadmin — both are
// full-privilege roles). For scoped roles (order_manager, product_manager,
// etc.) use requirePermission() from middleware/rbac.js instead.
const admin = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "superadmin")) {
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
    const token = authHeader.split(" ")[1];
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
