// Lightweight NoSQL-injection guard (Section 33).
//
// Recursively strips any object key that starts with '$' (a MongoDB
// operator, e.g. { email: { $ne: null } }) or contains a literal '.'
// (dot-notation field traversal), from req.body, req.params and req.query.
//
// Mutates objects IN PLACE rather than reassigning req.query/req.body —
// this matters because Express 5 makes req.query a getter-only property,
// which crashes popular packages like express-mongo-sanitize (they try to
// do req.query = sanitized, which throws "Cannot set property query of
// #<IncomingMessage> which has only a getter").
function sanitizeInPlace(obj) {
  if (!obj || typeof obj !== "object") return;

  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
      continue;
    }
    const value = obj[key];
    if (value && typeof value === "object") {
      sanitizeInPlace(value);
    }
  }
}

const sanitizeRequest = (req, res, next) => {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.params);
  sanitizeInPlace(req.query);
  next();
};

module.exports = sanitizeRequest;
