const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// Helper to generate unique order ID
const generateOrderId = () => {
  const dateStr = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `BB-${dateStr}-${randomNum}`;
};

// @route   POST /api/v1/orders
// @desc    Create new order in MongoDB
router.post('/', async (req, res) => {
  try {
    const customerName = req.body.customerName || req.body.shippingAddress?.fullName || 'Customer';
    const customerEmail = (req.body.customerEmail || req.body.email || '').toLowerCase();
    const customerPhone = req.body.customerPhone || req.body.shippingAddress?.phone || '';
    const items = req.body.items || req.body.orderItems || [];
    const shippingAddress = req.body.shippingAddress || {};
    const subtotal = Number(req.body.subtotal) || 0;
    const tax = Number(req.body.tax) || 0;
    const shipping = Number(req.body.shipping) || 0;
    const total = Number(req.body.total || req.body.grandTotal) || (subtotal + tax + shipping);
    const paymentMethod = req.body.paymentMethod || 'COD';
    const paymentStatus = req.body.paymentStatus || (paymentMethod.toUpperCase() === 'COD' ? 'Pending' : 'Paid');
    const razorpayOrderId = req.body.razorpayOrderId || '';
    const razorpayPaymentId = req.body.razorpayPaymentId || '';
    const razorpaySignature = req.body.razorpaySignature || '';

    if (!customerEmail || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid order details provided (email and items are required)' });
    }

    const orderId = generateOrderId();

    const order = await Order.create({
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      items,
      subtotal: subtotal || total,
      tax: tax || 0,
      shipping: shipping || 0,
      total,
      paymentMethod: paymentMethod || 'COD',
      paymentStatus: paymentStatus || (paymentMethod === 'COD' ? 'Pending' : 'Paid'),
      razorpayOrderId: razorpayOrderId || '',
      razorpayPaymentId: razorpayPaymentId || '',
      razorpaySignature: razorpaySignature || '',
      orderStatus: 'Processing'
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: {
        id: order._id,
        orderId: order.orderId,
        ...order.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/v1/orders
// @desc    Get orders list
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    const filter = {};

    if (email) {
      filter.customerEmail = email.toLowerCase();
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
// @desc    Get current user's orders
router.get('/my-orders', async (req, res) => {
  try {
    let email = req.query.email;

    if (!email && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'beard_banna_royal_secret_2026');
        const User = require('../models/User');
        const user = await User.findById(decoded.id);
        if (user) email = user.email;
      } catch (e) {}
    }

    if (!email) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: { orders: [] }
      });
    }

    const orders = await Order.find({ customerEmail: email.toLowerCase() }).sort({ createdAt: -1 });

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
// @desc    Track order details by Order ID
router.get('/track/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId.trim();
    const order = await Order.findOne({ 
      $or: [
        { orderId: orderId },
        { orderId: orderId.toUpperCase() }
      ]
    });

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
// @desc    Update order status (Admin)
router.put('/:id/status', async (req, res) => {
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
