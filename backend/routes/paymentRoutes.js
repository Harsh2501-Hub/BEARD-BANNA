const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');

/**
 * Returns a configured Razorpay client instance using environment variables.
 */
const getRazorpayClient = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('Razorpay API credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are missing from server environment.');
  }

  return new Razorpay({
    key_id,
    key_secret
  });
};

// @route   GET /api/v1/payment/config
// @desc    Get the public Razorpay Key ID for frontend SDK initialization
router.get('/config', (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  if (!keyId) {
    return res.status(500).json({
      success: false,
      message: 'Razorpay Key ID is not configured on the server.'
    });
  }

  res.json({
    success: true,
    keyId
  });
});

// @route   POST /api/v1/payment/create-order
// @desc    Create a new Razorpay Order entity
router.post('/create-order', async (req, res) => {
  try {
    const { amount, receipt, notes } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid order amount is required.'
      });
    }

    const rzp = getRazorpayClient();

    // Razorpay requires amount in currency subunits (paise for INR)
    const amountInPaise = Math.round(Number(amount) * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receipt || `rcpt_${Date.now().toString().slice(-8)}`,
      payment_capture: 1, // Auto-capture payments
      notes: notes || {}
    };

    const order = await rzp.orders.create(options);

    res.status(201).json({
      success: true,
      order,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('❌ Razorpay Create Order Error:', error);
    res.status(500).json({
      success: false,
      message: error.description || error.message || 'Failed to create Razorpay order'
    });
  }
});

// @route   POST /api/v1/payment/verify
// @desc    Verify payment signature generated after checkout
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required signature verification parameters.'
      });
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
      return res.status(500).json({
        success: false,
        message: 'Server missing Razorpay secret key.'
      });
    }

    // Razorpay standard HMAC-SHA256 signature verification:
    // signature = hmac_sha256(order_id + "|" + payment_id, secret)
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (isValid) {
      return res.json({
        success: true,
        message: 'Payment verified successfully',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Verification failed.'
      });
    }
  } catch (error) {
    console.error('❌ Razorpay Verification Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error occurred while verifying payment'
    });
  }
});

module.exports = router;
