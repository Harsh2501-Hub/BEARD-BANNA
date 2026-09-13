const express = require('express');
const router = express.Router();
const Inquiry = require('../models/Inquiry');

// @route   POST /api/v1/inquiries
// @desc    Submit contact message
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required' });
    }

    const inquiry = await Inquiry.create({
      name,
      email,
      phone: phone || '',
      subject: subject || 'General Inquiry',
      message
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully! Our team will contact you shortly.',
      data: inquiry
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/v1/inquiries
// @desc    Get all contact inquiries (Admin)
router.get('/', async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: inquiries.length,
      data: inquiries
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
