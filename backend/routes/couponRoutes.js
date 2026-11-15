const express = require('express');
const router = express.Router();

/**
 * Authoritative active coupons dictionary.
 */
const ACTIVE_COUPONS = {
  'ROYAL10': {
    code: 'ROYAL10',
    discountPercent: 10,
    minOrderAmount: 999,
    maxDiscount: 300,
    expiresAt: '2027-12-31T23:59:59.000Z'
  },
  'BANNA15': {
    code: 'BANNA15',
    discountPercent: 15,
    minOrderAmount: 1499,
    maxDiscount: 500,
    expiresAt: '2027-12-31T23:59:59.000Z'
  }
};

// @route   POST /api/v1/coupons/validate
// @desc    Validate coupon and calculate authoritative server-side discount
router.post('/validate', (req, res) => {
  try {
    const rawCode = String(req.body.code || '').toUpperCase().trim();
    const orderAmount = Number(req.body.orderAmount) || 0;

    if (!rawCode) {
      return res.status(400).json({ success: false, message: 'Please enter a coupon code' });
    }

    if (orderAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order amount for coupon application' });
    }

    const coupon = ACTIVE_COUPONS[rawCode];
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or unrecognised coupon code' });
    }

    if (new Date() > new Date(coupon.expiresAt)) {
      return res.status(400).json({ success: false, message: 'This coupon has expired' });
    }

    if (orderAmount < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Coupon requires a minimum order value of ₹${coupon.minOrderAmount}`
      });
    }

    let discount = Math.round((orderAmount * (coupon.discountPercent / 100)) * 100) / 100;
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }

    res.json({
      success: true,
      message: `Royal Coupon ${coupon.code} applied! Saved ₹${discount}`,
      data: {
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        discountAmount: discount,
        discount: discount, // For direct client consumption
        minOrderAmount: coupon.minOrderAmount,
        finalAmount: Math.max(0, orderAmount - discount)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
