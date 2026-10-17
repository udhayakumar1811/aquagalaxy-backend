const jwt = require("jsonwebtoken");

// JWT_SECRET must be set in the environment — there is intentionally NO
// hardcoded fallback here. Using a fallback secret in source code means
// anyone who reads the code (or the public repo) could forge valid tokens,
// including admin tokens, if the real .env value were ever missing.
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set in the environment. Set it in your .env file before starting the server."
    );
  }
  return secret;
};

// `tokenVersion` (claim `v`) lets a password reset invalidate every token
// issued before it, without any server-side session/blacklist store — see
// models/userModel.js and middleware/authMiddleware.js. Defaults to 0 so
// existing call sites that don't pass it are unaffected.
const generateToken = (id, tokenVersion = 0) => {
  return jwt.sign({ id, v: tokenVersion }, getJwtSecret(), { expiresIn: "30d" });
};

module.exports = { generateToken, getJwtSecret };
