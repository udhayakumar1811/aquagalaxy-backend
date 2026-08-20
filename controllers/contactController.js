const ContactMessage = require("../models/contactModel");

// @desc    Save a contact form submission from the website
// @route   POST /api/contact
// @access  Public
const createContactMessage = async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill in all required fields." });
    }

    const newMessage = new ContactMessage({ name, email, phone, message });
    await newMessage.save();

    res.status(201).json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error("Error saving contact message:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Fetch all contact messages for Admin Dashboard
// @route   GET /api/admin/contacts
// @access  Private/Admin
const getContactMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error("Error fetching contact messages:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a contact message
// @route   DELETE /api/admin/contacts/:id
// @access  Private/Admin
const deleteContactMessage = async (req, res) => {
  try {
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    res.json({ success: true, message: "Message deleted successfully!" });
  } catch (err) {
    console.error("Error deleting contact message:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { createContactMessage, getContactMessages, deleteContactMessage };
