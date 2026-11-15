const express = require('express');
const router = express.Router();
const Inquiry = require('../models/Inquiry');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// @route   POST /api/v1/inquiries
// @desc    Submit contact message
router.post('/', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 100);
    const email = String(req.body.email || '').toLowerCase().trim().slice(0, 120);
    const phone = String(req.body.phone || '').trim().slice(0, 30);
    const subject = String(req.body.subject || 'General Inquiry').trim().slice(0, 150);
    const message = String(req.body.message || '').trim().slice(0, 3000);

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required' });
    }

    const inquiry = await Inquiry.create({
      name,
      email,
      phone,
      subject,
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
// @desc    Get all contact inquiries (Admin Only)
router.get('/', protect, adminOnly, async (req, res) => {
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
