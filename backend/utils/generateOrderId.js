const Counter = require("../models/counterModel");

// Atomically generates the next order number, e.g. "AQ1001", "AQ1002"...
// Uses findOneAndUpdate with $inc so concurrent order creations never
// collide, even under load.
const generateOrderNumber = async () => {
  const counter = await Counter.findOneAndUpdate(
    { _id: "orderNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `AQ${counter.seq}`;
};

module.exports = { generateOrderNumber };
