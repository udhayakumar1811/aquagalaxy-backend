const mongoose = require("mongoose");

// Generic atomic counter, used to generate sequential human-readable IDs
// (e.g. order numbers AQ1001, AQ1002...) without race conditions.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "orderNumber"
  seq: { type: Number, default: 1000 },
});

module.exports = mongoose.model("Counter", counterSchema);
