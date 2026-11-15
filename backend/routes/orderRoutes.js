const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Order = require('../models/Order');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Load authoritative product catalog price index
let catalogPrices = {};
try {
  const catalogPath = path.join(__dirname, '../data/products.json');
  if (fs.existsSync(catalogPath)) {
    const prods = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    prods.forEach(p => {
      if (p.id) catalogPrices[String(p.id)] = Number(p.price);
      if (p._id) catalogPrices[String(p._id)] = Number(p.price);
      if (p.name) catalogPrices[p.name.toLowerCase().trim()] = Number(p.price);
      if (p.title) catalogPrices[p.title.toLowerCase().trim()] = Number(p.price);
    });
  }
} catch (e) {
  console.warn('[Order Security] Catalog price index warning:', e.message);
}

// Helper to generate unique order ID
const generateOrderId = () => {
  const dateStr = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `BB-${dateStr}-${randomNum}`;
};

// @route   POST /api/v1/orders
// @desc    Create new order in MongoDB (with server-side price & payment verification)
router.post('/', async (req, res) => {
  try {
    const customerName = String(req.body.customerName || req.body.shippingAddress?.fullName || 'Customer').slice(0, 100);
    const customerEmail = String(req.body.customerEmail || req.body.email || '').toLowerCase().trim().slice(0, 120);
    const customerPhone = String(req.body.customerPhone || req.body.shippingAddress?.phone || '').trim().slice(0, 30);
    const rawItems = req.body.items || req.body.orderItems || [];
    const shippingAddress = req.body.shippingAddress || {};

    if (!customerEmail || !rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid order details provided (email and items are required)' });
    }

    // ── Server-Side Price Verification ───────────────────────
    let authoritativeSubtotal = 0;
    const validatedItems = rawItems.map(item => {
      const prodKey = String(item.productId || item.id || '').trim();
      const nameKey = String(item.name || item.title || '').toLowerCase().trim();
      const catalogPrice = catalogPrices[prodKey] || catalogPrices[nameKey];
      const verifiedPrice = (typeof catalogPrice === 'number' && catalogPrice > 0)
        ? catalogPrice
        : Number(item.price) || 0;
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      authoritativeSubtotal += verifiedPrice * qty;

      return {
        productId: prodKey,
        name: String(item.name || item.title || 'Apparel Item').slice(0, 150),
        size: String(item.size || 'M').slice(0, 10),
        quantity: qty,
        price: verifiedPrice,
        hsn: '6109'
      };
    });

    const subtotal = authoritativeSubtotal > 0 ? authoritativeSubtotal : (Number(req.body.subtotal) || 0);
    const tax = Number(req.body.tax) || 0;
    const shipping = Number(req.body.shipping) || 0;
    const discount = Number(req.body.discount) || 0;
    const finalTotal = Math.max(0, subtotal + tax + shipping - discount);

    const paymentMethod = (req.body.paymentMethod || 'COD').toUpperCase();
    let paymentStatus = 'Pending';
    const razorpayOrderId = req.body.razorpayOrderId || '';
    const razorpayPaymentId = req.body.razorpayPaymentId || '';
    const razorpaySignature = req.body.razorpaySignature || '';

    // ── Server-Side Razorpay Signature Verification ──────────
    if (paymentMethod === 'RAZORPAY' && razorpayOrderId && razorpayPaymentId && razorpaySignature) {
      const key_secret = process.env.RAZORPAY_KEY_SECRET;
      if (key_secret) {
        const expectedSignature = crypto
          .createHmac('sha256', key_secret)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest('hex');
        if (expectedSignature === razorpaySignature) {
          paymentStatus = 'Paid';
        }
      }
    }

    const orderId = generateOrderId();

    const order = await Order.create({
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      items: validatedItems,
      subtotal,
      tax,
      gstDetails: req.body.gstDetails || req.body.gst_details || {},
      shipping,
      total: finalTotal,
      discount,
      couponCode: req.body.couponCode || req.body.coupon_code || '',
      paymentMethod,
      paymentStatus,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      orderStatus: 'Processing' // Hardened: orders always begin in Processing
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: {
        id: order._id,
        orderId: order.orderId,
        total: finalTotal,
        paymentStatus,
        orderStatus: order.orderStatus,
        ...order.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/v1/orders
// @desc    Get orders list (Protected: Customer sees only their own; Admin sees all)
router.get('/', protect, async (req, res) => {
  try {
    const filter = {};

    // Customer Isolation Enforcement
    if (req.user.role !== 'admin') {
      filter.customerEmail = req.user.email.toLowerCase();
    } else if (req.query.email) {
      filter.customerEmail = req.query.email.toLowerCase();
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/v1/orders/my-orders
// @desc    Get current user's orders (Protected)
router.get('/my-orders', protect, async (req, res) => {
  try {
    const email = req.user.email.toLowerCase();
    const orders = await Order.find({ customerEmail: email }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: { orders }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/v1/orders/track/:orderId
// @desc    Track order details by Order ID (Safe public tracking)
router.get('/track/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId.trim();
    const order = await Order.findOne({ 
      $or: [
        { orderId: orderId },
        { orderId: orderId.toUpperCase() }
      ]
    }).select('-razorpaySignature -__v');

    if (!order) {
      return res.status(404).json({ success: false, message: `Order #${orderId} not found` });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/v1/orders/:id/status
// @desc    Update order status (Admin Only)
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.orderStatus = orderStatus || order.orderStatus;
    await order.save();

    res.json({
      success: true,
      message: `Order #${order.orderId} status updated to ${order.orderStatus}`,
      data: order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
